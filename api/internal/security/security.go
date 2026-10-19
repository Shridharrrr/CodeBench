package security

import (
	"fmt"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/codebench/codebench/api/internal/auth"
)

// SecurityHeaders applies strict HTTP security headers to all responses
func SecurityHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		h := w.Header()

		// Content Security Policy
		h.Set("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; connect-src 'self' ws: wss:; img-src 'self' data:; frame-ancestors 'none'; base-uri 'self'; form-action 'self';")

		// Clickjacking and MIME sniffing protections
		h.Set("X-Frame-Options", "DENY")
		h.Set("X-Content-Type-Options", "nosniff")

		// Referrer policy
		h.Set("Referrer-Policy", "strict-origin-when-cross-origin")

		// XSS Auditor legacy protection
		h.Set("X-XSS-Protection", "1; mode=block")

		// Permissions Policy (Camera, Microphone, Geolocation disabled)
		h.Set("Permissions-Policy", "camera=(), microphone=(), geolocation=()")

		next.ServeHTTP(w, r)
	})
}

// BodyLimit caps incoming request body size to prevent memory exhaustion and payload flooding
func BodyLimit(maxBytes int64) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.Body != nil {
				r.Body = http.MaxBytesReader(w, r.Body, maxBytes)
			}
			next.ServeHTTP(w, r)
		})
	}
}

// RateLimiter manages thread-safe token/sliding-window limits per client identifier
type RateLimiter struct {
	mu       sync.Mutex
	limits   map[string][]time.Time
	maxReqs  int
	window   time.Duration
	stopChan chan struct{}
}

// NewRateLimiter creates a new rate limiter
func NewRateLimiter(maxReqs int, window time.Duration) *RateLimiter {
	rl := &RateLimiter{
		limits:   make(map[string][]time.Time),
		maxReqs:  maxReqs,
		window:   window,
		stopChan: make(chan struct{}),
	}

	// Background cleanup of expired entries every minute
	go rl.cleanupLoop()
	return rl
}

func (rl *RateLimiter) cleanupLoop() {
	ticker := time.NewTicker(time.Minute)
	defer ticker.Stop()

	for {
		select {
		case <-rl.stopChan:
			return
		case now := <-ticker.C:
			rl.mu.Lock()
			cutoff := now.Add(-rl.window)
			for key, timestamps := range rl.limits {
				valid := make([]time.Time, 0, len(timestamps))
				for _, t := range timestamps {
					if t.After(cutoff) {
						valid = append(valid, t)
					}
				}
				if len(valid) == 0 {
					delete(rl.limits, key)
				} else {
					rl.limits[key] = valid
				}
			}
			rl.mu.Unlock()
		}
	}
}

func (rl *RateLimiter) Stop() {
	close(rl.stopChan)
}

// Allow checks if the client key has remaining quota within the window
func (rl *RateLimiter) Allow(key string) (bool, int) {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	now := time.Now()
	cutoff := now.Add(-rl.window)

	var valid []time.Time
	if timestamps, exists := rl.limits[key]; exists {
		for _, t := range timestamps {
			if t.After(cutoff) {
				valid = append(valid, t)
			}
		}
	}

	if len(valid) >= rl.maxReqs {
		rl.limits[key] = valid
		remainingSeconds := int(valid[0].Add(rl.window).Sub(now).Seconds()) + 1
		return false, remainingSeconds
	}

	valid = append(valid, now)
	rl.limits[key] = valid
	return true, 0
}

// Middleware creates a rate-limiting HTTP middleware
func (rl *RateLimiter) Middleware() func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Extract client key: authenticated user ID or Remote IP
			clientKey := extractClientKey(r)

			allowed, retryAfter := rl.Allow(clientKey)
			if !allowed {
				w.Header().Set("Retry-After", fmt.Sprintf("%d", retryAfter))
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusTooManyRequests)
				_, _ = w.Write([]byte(fmt.Sprintf(`{"error":"rate limit exceeded, please retry in %d seconds"}`, retryAfter)))
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

// RequireRole enforces role-based access control (e.g. "admin")
func RequireRole(role string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			u := auth.UserFromContext(r.Context())
			if u == nil {
				http.Error(w, `{"error":"authentication required"}`, http.StatusUnauthorized)
				return
			}
			if u.Role != role {
				http.Error(w, `{"error":"forbidden: insufficient permissions"}`, http.StatusForbidden)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

func extractClientKey(r *http.Request) string {
	if u := auth.UserFromContext(r.Context()); u != nil {
		return "user:" + u.ID.String()
	}

	ip := r.Header.Get("X-Forwarded-For")
	if ip == "" {
		ip = r.RemoteAddr
	}
	if idx := strings.Index(ip, ","); idx != -1 {
		ip = ip[:idx]
	}
	return "ip:" + strings.TrimSpace(ip)
}
