-- Temporary room holds during guest checkout (booking flow)

CREATE TABLE IF NOT EXISTS room_holds (
    id SERIAL PRIMARY KEY,
    room_id INT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    check_in TIMESTAMPTZ NOT NULL,
    check_out TIMESTAMPTZ NOT NULL,
    session_id VARCHAR(64) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_room_holds_room_id ON room_holds (room_id);
CREATE INDEX IF NOT EXISTS idx_room_holds_expires_at ON room_holds (expires_at);
CREATE INDEX IF NOT EXISTS idx_room_holds_session_id ON room_holds (session_id);
