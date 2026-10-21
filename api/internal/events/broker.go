package events

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"sync"
	"time"

	"github.com/codebench/codebench/api/internal/models"
)

type Event struct {
	ID        int64     `json:"id"`
	Type      string    `json:"type"`
	TargetID  string    `json:"target_id"` // submission_id
	Payload   any       `json:"payload"`
	CreatedAt time.Time `json:"created_at"`
}

type Broker struct {
	mu          sync.RWMutex
	subscribers map[string]map[chan Event]struct{}
	counter     int64
	history     []Event
	historyCap  int
}

func NewBroker() *Broker {
	return &Broker{
		subscribers: make(map[string]map[chan Event]struct{}),
		history:     make([]Event, 0, 1000),
		historyCap:  1000,
	}
}

func (b *Broker) Subscribe(targetID string, lastEventID int64) (chan Event, func()) {
	b.mu.Lock()
	defer b.mu.Unlock()

	ch := make(chan Event, 64)
	if _, exists := b.subscribers[targetID]; !exists {
		b.subscribers[targetID] = make(map[chan Event]struct{})
	}
	b.subscribers[targetID][ch] = struct{}{}

	// Replay missed events if requested
	if lastEventID > 0 {
		for _, ev := range b.history {
			if ev.TargetID == targetID && ev.ID > lastEventID {
				select {
				case ch <- ev:
				default:
				}
			}
		}
	}

	unsubscribe := func() {
		b.mu.Lock()
		defer b.mu.Unlock()
		if subs, exists := b.subscribers[targetID]; exists {
			delete(subs, ch)
			close(ch)
			if len(subs) == 0 {
				delete(b.subscribers, targetID)
			}
		}
	}

	return ch, unsubscribe
}

// ActiveConnections returns the total number of connected SSE clients
func (b *Broker) ActiveConnections() int {
	b.mu.RLock()
	defer b.mu.RUnlock()
	count := 0
	for _, subs := range b.subscribers {
		count += len(subs)
	}
	return count
}

func (b *Broker) PublishSubmissionStatus(submissionID string, status models.SubmissionStatus, verdict models.Verdict, detail any) {
	b.mu.Lock()
	defer b.mu.Unlock()

	b.counter++
	event := Event{
		ID:       b.counter,
		Type:     "submission_update",
		TargetID: submissionID,
		Payload: map[string]any{
			"submission_id": submissionID,
			"status":        status,
			"verdict":       verdict,
			"detail":        detail,
		},
		CreatedAt: time.Now().UTC(),
	}

	// Append to history buffer
	b.history = append(b.history, event)
	if len(b.history) > b.historyCap {
		b.history = b.history[1:]
	}

	// Dispatch to subscribers
	if subs, exists := b.subscribers[submissionID]; exists {
		for ch := range subs {
			select {
			case ch <- event:
			default:
				slog.Warn("Subscriber channel full, dropping event", "submission_id", submissionID, "event_id", event.ID)
			}
		}
	}
}

func (b *Broker) PublishLeaderboardUpdate(targetID string, payload any) {
	b.mu.Lock()
	defer b.mu.Unlock()

	b.counter++
	event := Event{
		ID:        b.counter,
		Type:      "leaderboard_update",
		TargetID:  targetID,
		Payload:   payload,
		CreatedAt: time.Now().UTC(),
	}

	b.history = append(b.history, event)
	if len(b.history) > b.historyCap {
		b.history = b.history[1:]
	}

	if subs, exists := b.subscribers[targetID]; exists {
		for ch := range subs {
			select {
			case ch <- event:
			default:
				slog.Warn("Subscriber channel full, dropping leaderboard event", "target_id", targetID, "event_id", event.ID)
			}
		}
	}
}

func (b *Broker) PublishEvent(targetID string, eventType string, payload any) {
	b.mu.Lock()
	defer b.mu.Unlock()

	b.counter++
	event := Event{
		ID:        b.counter,
		Type:      eventType,
		TargetID:  targetID,
		Payload:   payload,
		CreatedAt: time.Now().UTC(),
	}

	b.history = append(b.history, event)
	if len(b.history) > b.historyCap {
		b.history = b.history[1:]
	}

	if subs, exists := b.subscribers[targetID]; exists {
		for ch := range subs {
			select {
			case ch <- event:
			default:
				slog.Warn("Subscriber channel full, dropping event", "target_id", targetID, "type", eventType, "event_id", event.ID)
			}
		}
	}
}

func (b *Broker) StreamSSE(ctx context.Context, targetID string, lastEventID int64, sendFunc func(id int64, eventType string, data []byte) error) error {
	ch, unsubscribe := b.Subscribe(targetID, lastEventID)
	defer unsubscribe()

	heartbeat := time.NewTicker(15 * time.Second)
	defer heartbeat.Stop()

	for {
		select {
		case <-ctx.Done():
			return nil
		case <-heartbeat.C:
			if err := sendFunc(0, "heartbeat", []byte(`{"ping": true}`)); err != nil {
				return err
			}
		case ev, ok := <-ch:
			if !ok {
				return nil
			}
			data, err := json.Marshal(ev.Payload)
			if err != nil {
				continue
			}
			if err := sendFunc(ev.ID, ev.Type, data); err != nil {
				return fmt.Errorf("failed to send sse event: %w", err)
			}
		}
	}
}
