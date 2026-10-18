package config

import (
	"os"
	"strconv"
)

type Config struct {
	Env                  string
	Port                 int
	Host                 string
	DatabaseURL          string
	NATSEmbedded         bool
	NATSPort             int
	NATSStoreDir         string
	NATSToken            string
	NATSURL              string
	UseFakeJudge         bool
	AdminDefaultPassword string
	ProblemsDir          string
}

func Load() *Config {
	env := getEnv("CODEBENCH_ENV", "development")
	port, _ := strconv.Atoi(getEnv("CODEBENCH_PORT", "8080"))
	host := getEnv("CODEBENCH_HOST", "0.0.0.0")
	dbURL := getEnv("DATABASE_URL", "postgres://codebench:codebench_secret@localhost:5432/codebench?sslmode=disable")
	natsEmbedded := getEnv("NATS_EMBEDDED", "true") == "true"
	natsPort, _ := strconv.Atoi(getEnv("NATS_PORT", "4222"))
	natsStoreDir := getEnv("NATS_STORE_DIR", "./data/nats")
	natsToken := getEnv("NATS_TOKEN", "codebench-internal-nats-token")
	natsURL := getEnv("NATS_URL", "nats://localhost:4222")
	useFakeJudge := getEnv("USE_FAKE_JUDGE", "true") == "true"
	adminPassword := getEnv("ADMIN_DEFAULT_PASSWORD", "codebench123")
	problemsDir := getEnv("PROBLEMS_DIR", "./problems")

	return &Config{
		Env:                  env,
		Port:                 port,
		Host:                 host,
		DatabaseURL:          dbURL,
		NATSEmbedded:         natsEmbedded,
		NATSPort:             natsPort,
		NATSStoreDir:         natsStoreDir,
		NATSToken:            natsToken,
		NATSURL:              natsURL,
		UseFakeJudge:         useFakeJudge,
		AdminDefaultPassword: adminPassword,
		ProblemsDir:          problemsDir,
	}
}

func getEnv(key, defaultVal string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return defaultVal
}
