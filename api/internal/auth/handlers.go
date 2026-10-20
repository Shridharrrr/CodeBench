package auth

import (
	"encoding/json"
	"log/slog"
	"net/http"
	"net/mail"
	"strings"
	"time"

	"github.com/codebench/codebench/api/internal/database"
	"github.com/codebench/codebench/api/internal/models"
	"github.com/google/uuid"
)

type AuthHandler struct {
	db *database.DB
}

func NewAuthHandler(db *database.DB) *AuthHandler {
	return &AuthHandler{db: db}
}

const SessionDuration = 7 * 24 * time.Hour

func (h *AuthHandler) HandleRegister(w http.ResponseWriter, r *http.Request) {
	var req models.RegisterRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request payload"}`, http.StatusBadRequest)
		return
	}

	req.Email = strings.TrimSpace(strings.ToLower(req.Email))
	req.Name = strings.TrimSpace(req.Name)

	if req.Name == "" {
		http.Error(w, `{"error":"name is required"}`, http.StatusBadRequest)
		return
	}

	if _, err := mail.ParseAddress(req.Email); err != nil {
		http.Error(w, `{"error":"invalid email address"}`, http.StatusBadRequest)
		return
	}

	if len(req.Password) < 8 {
		http.Error(w, `{"error":"password must be at least 8 characters"}`, http.StatusBadRequest)
		return
	}

	// Check if email already registered
	existing, _ := h.db.GetUserByEmail(r.Context(), req.Email)
	if existing != nil {
		http.Error(w, `{"error":"email already registered"}`, http.StatusConflict)
		return
	}

	hashedPassword, err := HashPassword(req.Password)
	if err != nil {
		slog.Error("Failed to hash password with Argon2id", "error", err)
		http.Error(w, `{"error":"internal server error"}`, http.StatusInternalServerError)
		return
	}

	user, err := h.db.CreateUser(r.Context(), req.Name, req.Email, hashedPassword, "participant")
	if err != nil {
		slog.Error("Failed to create user", "error", err)
		http.Error(w, `{"error":"failed to create user"}`, http.StatusInternalServerError)
		return
	}

	// Create session
	token, csrf, err := h.createAndSetSession(w, r, user.ID)
	if err != nil {
		slog.Error("Failed to create session", "error", err)
		http.Error(w, `{"error":"failed to establish session"}`, http.StatusInternalServerError)
		return
	}
	_ = token

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	_ = json.NewEncoder(w).Encode(models.AuthResponse{
		User: models.UserProfile{
			ID:        user.ID,
			Name:      user.Name,
			Email:     user.Email,
			Role:      user.Role,
			CreatedAt: user.CreatedAt,
		},
		CSRFToken: csrf,
	})
}

func (h *AuthHandler) HandleLogin(w http.ResponseWriter, r *http.Request) {
	var req models.LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request payload"}`, http.StatusBadRequest)
		return
	}

	req.Email = strings.TrimSpace(strings.ToLower(req.Email))

	user, err := h.db.GetUserByEmail(r.Context(), req.Email)
	if err != nil || user == nil {
		http.Error(w, `{"error":"invalid email or password"}`, http.StatusUnauthorized)
		return
	}

	valid, err := VerifyPassword(req.Password, user.PasswordHash)
	if err != nil || !valid {
		http.Error(w, `{"error":"invalid email or password"}`, http.StatusUnauthorized)
		return
	}

	// Create session
	_, csrf, err := h.createAndSetSession(w, r, user.ID)
	if err != nil {
		slog.Error("Failed to create session on login", "error", err)
		http.Error(w, `{"error":"failed to establish session"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(models.AuthResponse{
		User: models.UserProfile{
			ID:        user.ID,
			Name:      user.Name,
			Email:     user.Email,
			Role:      user.Role,
			CreatedAt: user.CreatedAt,
		},
		CSRFToken: csrf,
	})
}

func (h *AuthHandler) HandleLogout(w http.ResponseWriter, r *http.Request) {
	if sess := SessionFromContext(r.Context()); sess != nil {
		_ = h.db.DeleteSession(r.Context(), sess.TokenHash)
	} else if cookie, err := r.Cookie(SessionCookieName); err == nil && cookie != nil && cookie.Value != "" {
		tokenHash := HashToken(cookie.Value)
		_ = h.db.DeleteSession(r.Context(), tokenHash)
	}

	ClearSessionCookie(w)
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte(`{"status":"logged_out"}`))
}

func (h *AuthHandler) HandleMe(w http.ResponseWriter, r *http.Request) {
	user := UserFromContext(r.Context())
	sess := SessionFromContext(r.Context())
	if user == nil || sess == nil {
		http.Error(w, `{"error":"unauthenticated"}`, http.StatusUnauthorized)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(models.AuthResponse{
		User: models.UserProfile{
			ID:        user.ID,
			Name:      user.Name,
			Email:     user.Email,
			Role:      user.Role,
			CreatedAt: user.CreatedAt,
		},
		CSRFToken: sess.CSRFToken,
	})
}

func (h *AuthHandler) createAndSetSession(w http.ResponseWriter, r *http.Request, userID uuid.UUID) (token, csrf string, err error) {
	token, err = GenerateRandomToken(32)
	if err != nil {
		return "", "", err
	}
	csrf, err = GenerateRandomToken(32)
	if err != nil {
		return "", "", err
	}

	tokenHash := HashToken(token)
	expiresAt := time.Now().UTC().Add(SessionDuration)

	session := &models.Session{
		ID:        uuid.New(),
		UserID:    userID,
		TokenHash: tokenHash,
		CSRFToken: csrf,
		ExpiresAt: expiresAt,
		CreatedAt: time.Now().UTC(),
		UserAgent: r.UserAgent(),
		IPAddress: r.RemoteAddr,
	}

	if err := h.db.CreateSession(r.Context(), session); err != nil {
		return "", "", err
	}

	SetSessionCookie(w, token, int(SessionDuration.Seconds()))
	return token, csrf, nil
}
