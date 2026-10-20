package auth

import (
	"context"
	"crypto/subtle"
	"net/http"
	"strings"
	"time"

	"github.com/codebench/codebench/api/internal/database"
	"github.com/codebench/codebench/api/internal/models"
)

type contextKey string

const (
	userContextKey    contextKey = "auth_user"
	sessionContextKey contextKey = "auth_session"
	SessionCookieName            = "cb_session"
)

// WithUser returns a new context containing the specified user
func WithUser(ctx context.Context, u *models.User) context.Context {
	return context.WithValue(ctx, userContextKey, u)
}

// UserFromContext retrieves the authenticated user from context, or nil if unauthenticated
func UserFromContext(ctx context.Context) *models.User {
	val := ctx.Value(userContextKey)
	if u, ok := val.(*models.User); ok {
		return u
	}
	return nil
}

// SessionFromContext retrieves the active session from context, or nil
func SessionFromContext(ctx context.Context) *models.Session {
	val := ctx.Value(sessionContextKey)
	if s, ok := val.(*models.Session); ok {
		return s
	}
	return nil
}

// AuthMiddleware inspects incoming requests for a valid session cookie and injects the user & session
func AuthMiddleware(db *database.DB) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			cookie, err := r.Cookie(SessionCookieName)
			if err != nil || cookie == nil || strings.TrimSpace(cookie.Value) == "" {
				// No session cookie, continue unauthenticated
				next.ServeHTTP(w, r)
				return
			}

			rawToken := cookie.Value
			tokenHash := HashToken(rawToken)

			sess, user, err := db.GetSessionByTokenHash(r.Context(), tokenHash)
			if err != nil || sess == nil || user == nil {
				// Invalid or expired session cookie, clear it and proceed unauthenticated
				ClearSessionCookie(w)
				next.ServeHTTP(w, r)
				return
			}

			// Attach session & user to request context
			ctx := context.WithValue(r.Context(), userContextKey, user)
			ctx = context.WithValue(ctx, sessionContextKey, sess)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// RequireAuth blocks unauthenticated requests with 401 Unauthorized
func RequireAuth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		u := UserFromContext(r.Context())
		if u == nil {
			http.Error(w, `{"error":"authentication required"}`, http.StatusUnauthorized)
			return
		}
		next.ServeHTTP(w, r)
	})
}

// RequireCSRF verifies CSRF token for mutating state requests from authenticated users
func RequireCSRF(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet, http.MethodHead, http.MethodOptions, http.MethodTrace:
			// Safe methods exempt from CSRF
			next.ServeHTTP(w, r)
			return
		}

		// Auth lifecycle endpoints (login, register, logout) do not require CSRF token
		if r.URL.Path == "/api/auth/login" || r.URL.Path == "/api/auth/register" || r.URL.Path == "/api/auth/logout" {
			next.ServeHTTP(w, r)
			return
		}

		sess := SessionFromContext(r.Context())
		if sess != nil {
			csrfHeader := r.Header.Get("X-CSRF-Token")
			if csrfHeader == "" || subtle.ConstantTimeCompare([]byte(csrfHeader), []byte(sess.CSRFToken)) != 1 {
				http.Error(w, `{"error":"invalid or missing CSRF token"}`, http.StatusForbidden)
				return
			}
		}

		next.ServeHTTP(w, r)
	})
}

// SetSessionCookie sets a secure, HTTP-only session cookie
func SetSessionCookie(w http.ResponseWriter, token string, maxAge int) {
	http.SetCookie(w, &http.Cookie{
		Name:     SessionCookieName,
		Value:    token,
		Path:     "/",
		MaxAge:   maxAge,
		HttpOnly: true,
		Secure:   false, // Set to true behind TLS/production Caddy, false permits localhost dev
		SameSite: http.SameSiteLaxMode,
	})
}

// ClearSessionCookie clears the session cookie
func ClearSessionCookie(w http.ResponseWriter) {
	http.SetCookie(w, &http.Cookie{
		Name:     SessionCookieName,
		Value:    "",
		Path:     "/",
		MaxAge:   -1,
		Expires:  time.Unix(0, 0),
		HttpOnly: true,
		Secure:   false,
		SameSite: http.SameSiteLaxMode,
	})
}
