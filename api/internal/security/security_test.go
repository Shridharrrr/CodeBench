package security

import (
	"bytes"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/codebench/codebench/api/internal/auth"
	"github.com/codebench/codebench/api/internal/models"
	"github.com/google/uuid"
)

func TestSecurityHeaders(t *testing.T) {
	handler := SecurityHeaders(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("ok"))
	}))

	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)

	res := rr.Result()
	defer res.Body.Close()

	if res.StatusCode != http.StatusOK {
		t.Fatalf("expected status 200, got %d", res.StatusCode)
	}

	expectedHeaders := map[string]string{
		"X-Frame-Options":        "DENY",
		"X-Content-Type-Options": "nosniff",
		"Referrer-Policy":        "strict-origin-when-cross-origin",
		"Permissions-Policy":     "camera=(), microphone=(), geolocation=()",
		"X-XSS-Protection":       "1; mode=block",
	}

	for k, v := range expectedHeaders {
		if got := res.Header.Get(k); got != v {
			t.Errorf("header %s mismatch: expected %q, got %q", k, v, got)
		}
	}

	csp := res.Header.Get("Content-Security-Policy")
	if !strings.Contains(csp, "default-src 'self'") || !strings.Contains(csp, "frame-ancestors 'none'") {
		t.Errorf("CSP missing expected security directives: got %s", csp)
	}
}

func TestBodyLimit(t *testing.T) {
	const maxBytes = 100
	middleware := BodyLimit(maxBytes)

	handler := middleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, err := io.ReadAll(r.Body)
		if err != nil {
			http.Error(w, err.Error(), http.StatusRequestEntityTooLarge)
			return
		}
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write(body)
	}))

	// 1. Within limit
	smallPayload := bytes.Repeat([]byte("a"), 50)
	req := httptest.NewRequest(http.MethodPost, "/upload", bytes.NewReader(smallPayload))
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)
	if rr.Code != http.StatusOK {
		t.Errorf("expected status 200 for payload within limit, got %d", rr.Code)
	}

	// 2. Exceeding limit
	oversizedPayload := bytes.Repeat([]byte("b"), 200)
	req = httptest.NewRequest(http.MethodPost, "/upload", bytes.NewReader(oversizedPayload))
	rr = httptest.NewRecorder()
	handler.ServeHTTP(rr, req)
	if rr.Code != http.StatusRequestEntityTooLarge {
		t.Errorf("expected status 413 for oversized payload, got %d", rr.Code)
	}
}

func TestRateLimiter(t *testing.T) {
	rl := NewRateLimiter(3, 200*time.Millisecond)
	defer rl.Stop()

	key := "test-client-ip"

	// 3 requests allowed
	for i := 1; i <= 3; i++ {
		allowed, retryAfter := rl.Allow(key)
		if !allowed {
			t.Fatalf("request %d should be allowed, but was rejected with retry-after %d", i, retryAfter)
		}
	}

	// 4th request rejected
	allowed, retryAfter := rl.Allow(key)
	if allowed {
		t.Fatal("request 4 should be rejected by rate limiter, but was allowed")
	}
	if retryAfter <= 0 {
		t.Errorf("expected positive retry-after duration, got %d", retryAfter)
	}

	// Wait for window to slide
	time.Sleep(250 * time.Millisecond)

	// Should be allowed again
	allowed, _ = rl.Allow(key)
	if !allowed {
		t.Error("request after window expiry should be allowed")
	}
}

func TestRateLimiterMiddleware(t *testing.T) {
	rl := NewRateLimiter(2, 500*time.Millisecond)
	defer rl.Stop()

	handler := rl.Middleware()(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("success"))
	}))

	// First 2 requests should succeed
	for i := 0; i < 2; i++ {
		req := httptest.NewRequest(http.MethodGet, "/rate-limited", nil)
		req.RemoteAddr = "192.168.1.100:12345"
		rr := httptest.NewRecorder()
		handler.ServeHTTP(rr, req)
		if rr.Code != http.StatusOK {
			t.Fatalf("request %d expected status 200, got %d", i+1, rr.Code)
		}
	}

	// 3rd request should fail with 429 Too Many Requests
	req := httptest.NewRequest(http.MethodGet, "/rate-limited", nil)
	req.RemoteAddr = "192.168.1.100:12345"
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusTooManyRequests {
		t.Fatalf("expected status 429, got %d", rr.Code)
	}
	if rr.Header().Get("Retry-After") == "" {
		t.Error("expected Retry-After header in 429 response")
	}
}

func TestRequireRole(t *testing.T) {
	adminRoleMiddleware := RequireRole("admin")
	protectedHandler := adminRoleMiddleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("admin access granted"))
	}))

	// Case 1: Unauthenticated -> 401 Unauthorized
	req := httptest.NewRequest(http.MethodGet, "/admin/dashboard", nil)
	rr := httptest.NewRecorder()
	protectedHandler.ServeHTTP(rr, req)
	if rr.Code != http.StatusUnauthorized {
		t.Errorf("unauthenticated request expected 401, got %d", rr.Code)
	}

	// Case 2: Authenticated as participant -> 403 Forbidden
	participant := &models.User{
		ID:    uuid.New(),
		Name:  "contestant1",
		Email: "contestant1@example.com",
		Role:  "participant",
	}
	req = httptest.NewRequest(http.MethodGet, "/admin/dashboard", nil)
	req = req.WithContext(auth.WithUser(req.Context(), participant))
	rr = httptest.NewRecorder()
	protectedHandler.ServeHTTP(rr, req)
	if rr.Code != http.StatusForbidden {
		t.Errorf("participant request expected 403, got %d", rr.Code)
	}

	// Case 3: Authenticated as admin -> 200 OK
	admin := &models.User{
		ID:    uuid.New(),
		Name:  "superadmin",
		Email: "admin@example.com",
		Role:  "admin",
	}
	req = httptest.NewRequest(http.MethodGet, "/admin/dashboard", nil)
	req = req.WithContext(auth.WithUser(req.Context(), admin))
	rr = httptest.NewRecorder()
	protectedHandler.ServeHTTP(rr, req)
	if rr.Code != http.StatusOK {
		t.Errorf("admin request expected 200, got %d", rr.Code)
	}
}
