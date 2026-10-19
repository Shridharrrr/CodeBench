package main

import (
	"fmt"
	"net"
	"os"
)

func runAddJudge() {
	fmt.Println("==========================================================")
	fmt.Println("       Codebench Remote Judge Worker Attachment")
	fmt.Println("==========================================================")

	lanIP := detectHostLANIP()
	natsToken := os.Getenv("NATS_TOKEN")
	if natsToken == "" {
		natsToken = "codebench_dev_token"
	}

	fmt.Println("To attach an additional judge host of the SAME hardware class to Codebench:")
	fmt.Println("\n1. (Recommended) Apply bare-metal tuning on the remote judge host:")
	fmt.Println("   sudo ./codebench tune")
	fmt.Println("\n2. Launch the judge daemon container on the remote host:")
	fmt.Printf(`
docker run -d \
  --name codebench-judge-worker \
  --restart unless-stopped \
  --privileged \
  --network host \
  --cgroupns host \
  -e NATS_URL=nats://%s:4222 \
  -e NATS_TOKEN=%s \
  -e JUDGE_HOST=judge-$(hostname) \
  -e HARDWARE_CLASS=grade-a-x86_64 \
  -v /sys/fs/cgroup:/sys/fs/cgroup:rw \
  codebench-judge:latest
`, lanIP, natsToken)

	fmt.Println("\n3. If isolated CPU cores (e.g., isolcpus=2-7) are configured on the remote host,")
	fmt.Println("   pin the worker container to those isolated cores using Docker:")
	fmt.Println("   --cpuset-cpus=\"2-7\"")
	fmt.Println("\n4. Confirm connection in the metrics dashboard or via:")
	fmt.Printf("   curl -s http://%s:8080/metrics | grep codebench_judge_hosts\n", lanIP)
	fmt.Println("==========================================================")
}

func detectHostLANIP() string {
	addrs, err := net.InterfaceAddrs()
	if err == nil {
		for _, addr := range addrs {
			if ipNet, ok := addr.(*net.IPNet); ok && !ipNet.IP.IsLoopback() {
				if ipNet.IP.To4() != nil {
					return ipNet.IP.String()
				}
			}
		}
	}
	return "YOUR_SERVER_IP"
}
