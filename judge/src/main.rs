use anyhow::Result;
use codebench_judge::pipeline::JudgePipeline;
use codebench_judge::protocol::JudgeJobPayload;
use codebench_judge::sandbox::isolate::IsolateAdapter;
use codebench_judge::sandbox::native::NativeRunner;
use codebench_judge::sandbox::probe::CapabilityProbe;
use codebench_judge::sandbox::SandboxRunner;
use futures::StreamExt;
use std::env;
use std::path::PathBuf;
use tracing::{error, info};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

#[tokio::main]
async fn main() -> Result<()> {
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "info".into()),
        )
        .with(tracing_subscriber::fmt::layer().json())
        .init();

    info!("Starting Codebench Judge Daemon...");

    // 1. Run Host Capability Probe
    let caps = CapabilityProbe::probe();
    info!(
        cgroup_v2 = caps.cgroup_v2,
        user_namespaces = caps.namespaces_user,
        timing_grade = %caps.timing_grade,
        reason = %caps.grade_reason,
        "Host capability probe completed"
    );

    // 2. Select Sandbox Runner (Native Linux or Isolate Adapter)
    let runner_type = env::var("SANDBOX_RUNNER").unwrap_or_else(|_| "native".to_string());
    let cgroup_base = PathBuf::from(
        env::var("CGROUP_BASE").unwrap_or_else(|_| "/sys/fs/cgroup/codebench".to_string()),
    );
    let work_dir = PathBuf::from(
        env::var("WORK_DIR").unwrap_or_else(|_| "/var/run/codebench/work".to_string()),
    );
    let cache_dir = PathBuf::from(
        env::var("CACHE_DIR").unwrap_or_else(|_| "/var/cache/codebench".to_string()),
    );

    let runner: Box<dyn SandboxRunner> = if runner_type == "isolate" {
        info!("Using Isolate reference adapter");
        Box::new(IsolateAdapter::new())
    } else {
        info!("Using Native Linux sandbox runner");
        Box::new(NativeRunner::new(cgroup_base))
    };

    let pipeline = JudgePipeline::new(runner, work_dir, cache_dir);

    // 3. Connect to NATS JetStream
    let nats_url = env::var("NATS_URL").unwrap_or_else(|_| "nats://localhost:4222".to_string());
    let judge_host = env::var("JUDGE_HOST").unwrap_or_else(|_| "judge-slot-0".to_string());

    info!(
        nats_url = %nats_url,
        judge_host = %judge_host,
        "Connecting to NATS JetStream..."
    );

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
            Ok(message) => match serde_json::from_slice::<JudgeJobPayload>(&message.payload) {
                Ok(job) => {
                    info!(
                        submission_id = %job.submission_id,
                        language = %job.language,
                        "Processing submission job"
                    );

                    let verdict = match pipeline.execute(&job, &judge_host) {
                        Ok(v) => v,
                        Err(e) => {
                            error!(error = %e, "Pipeline execution error");
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
                        info!(
                            submission_id = %job.submission_id,
                            verdict = ?verdict.verdict,
                            "Verdict published to NATS"
                        );
                        let _ = message.ack().await;
                    }
                }
                Err(e) => {
                    error!(error = %e, "Failed to parse job payload");
                    let _ = message.ack().await;
                }
            },
            Err(e) => {
                error!(error = %e, "Message stream error");
            }
        }
    }

    Ok(())
}
