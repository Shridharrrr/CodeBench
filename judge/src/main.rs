mod pipeline;
mod protocol;
mod sandbox;

use anyhow::Result;
use futures::StreamExt;
use pipeline::Pipeline;
use protocol::JudgeJobPayload;
use sandbox::CapabilityProbe;
use std::env;
use tracing::{error, info};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

#[tokio::main]
async fn main() -> Result<()> {
    tracing_subscriber::registry()
        .with(tracing_subscriber::EnvFilter::try_from_default_env().unwrap_or_else(|_| "info".into()))
        .with(tracing_subscriber::fmt::layer().json())
        .init();

    info!("Starting Codebench Judge Daemon...");

    let caps = CapabilityProbe::probe();
    info!(
        cgroup_v2 = caps.cgroup_v2,
        user_namespaces = caps.user_namespaces,
        timing_grade = %caps.timing_grade,
        "Host capability probe completed"
    );

    let nats_url = env::var("NATS_URL").unwrap_or_else(|_| "nats://localhost:4222".to_string());
    let judge_host = env::var("JUDGE_HOST").unwrap_or_else(|_| "judge-slot-0".to_string());

    info!(nats_url = %nats_url, judge_host = %judge_host, "Connecting to NATS JetStream...");

    let client = match async_nats::connect(&nats_url).await {
        Ok(c) => c,
        Err(e) => {
            error!(error = %e, "Could not connect to NATS, exiting");
            return Err(e.into());
        }
    };

    let jetstream = async_nats::jetstream::new(client.clone());

    let stream = match jetstream.get_stream("CODEBENCH_JOBS").await {
        Ok(s) => s,
        Err(e) => {
            error!(error = %e, "Stream CODEBENCH_JOBS not available yet");
            return Err(e.into());
        }
    };

    let consumer = stream
        .create_consumer(async_nats::jetstream::consumer::pull::Config {
            durable_name: Some("judge-pull-consumer".to_string()),
            filter_subject: "jobs.*".to_string(),
            ..Default::default()
        })
        .await?;

    info!("Judge daemon ready and pulling jobs from CODEBENCH_JOBS...");

    let mut messages = consumer.messages().await?;

    while let Some(msg) = messages.next().await {
        match msg {
            Ok(message) => {
                match serde_json::from_slice::<JudgeJobPayload>(&message.payload) {
                    Ok(job) => {
                        info!(submission_id = %job.submission_id, "Received submission job");
                        let verdict = match Pipeline::execute_job(&job, &judge_host) {
                            Ok(v) => v,
                            Err(e) => {
                                error!(error = %e, "Pipeline failure");
                                continue;
                            }
                        };

                        let payload_bytes = serde_json::to_vec(&verdict)?;
                        if let Err(e) = client
                            .publish("verdicts.submissions", payload_bytes.into())
                            .await
                        {
                            error!(error = %e, "Failed to publish verdict to NATS");
                        } else {
                            info!(submission_id = %job.submission_id, "Verdict published to NATS");
                            let _ = message.ack().await;
                        }
                    }
                    Err(e) => {
                        error!(error = %e, "Failed to parse job payload");
                        let _ = message.ack().await;
                    }
                }
            }
            Err(e) => {
                error!(error = %e, "Message stream error");
            }
        }
    }

    Ok(())
}
