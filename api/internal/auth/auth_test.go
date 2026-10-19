package auth

import (
	"testing"

	"golang.org/x/crypto/bcrypt"
)

func TestArgon2idHashingAndVerification(t *testing.T) {
	password := "super-secure-P@ssw0rd!"

	encodedHash, err := HashPassword(password)
	if err != nil {
		t.Fatalf("HashPassword failed: %v", err)
	}

	if encodedHash == "" {
		t.Fatalf("Expected non-empty hash string")
	}

	// Verify correct password
	valid, err := VerifyPassword(password, encodedHash)
	if err != nil {
		t.Fatalf("VerifyPassword returned error: %v", err)
	}
	if !valid {
		t.Fatalf("VerifyPassword expected true, got false")
	}

	// Verify incorrect password
	valid, err = VerifyPassword("wrong-password", encodedHash)
	if err != nil {
		t.Fatalf("VerifyPassword with wrong password returned error: %v", err)
	}
	if valid {
		t.Fatalf("VerifyPassword with wrong password expected false, got true")
	}
}

func TestVerifyLegacyBcryptFallback(t *testing.T) {
	password := "legacy-password-123"
	bcryptHash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		t.Fatalf("bcrypt generation failed: %v", err)
	}

	valid, err := VerifyPassword(password, string(bcryptHash))
	if err != nil {
		t.Fatalf("VerifyPassword on bcrypt returned error: %v", err)
	}
	if !valid {
		t.Fatalf("Expected bcrypt verify to succeed")
	}

	valid, err = VerifyPassword("different", string(bcryptHash))
	if err != nil {
		t.Fatalf("VerifyPassword on wrong bcrypt returned error: %v", err)
	}
	if valid {
		t.Fatalf("Expected wrong password to fail bcrypt verify")
	}
}

func TestTokenGenerationAndHashing(t *testing.T) {
	t1, err := GenerateRandomToken(32)
	if err != nil {
		t.Fatalf("GenerateRandomToken failed: %v", err)
	}
	t2, err := GenerateRandomToken(32)
	if err != nil {
		t.Fatalf("GenerateRandomToken failed: %v", err)
	}

	if t1 == t2 {
		t.Fatalf("Expected unique random tokens, got duplicates")
	}
	if len(t1) != 64 { // 32 bytes hex-encoded = 64 hex chars
		t.Fatalf("Expected 64 hex chars, got %d", len(t1))
	}

	h1 := HashToken(t1)
	h2 := HashToken(t1)
	if h1 != h2 {
		t.Fatalf("Expected deterministic SHA-256 hash")
	}
	if len(h1) != 64 {
		t.Fatalf("Expected 64 hex chars for SHA-256 hash")
	}
}
