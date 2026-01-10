CREATE TABLE IF NOT EXISTS rooms (
    id SERIAL PRIMARY KEY,
    room_number VARCHAR(10) UNIQUE NOT NULL,
    type VARCHAR(20),
    price DECIMAL(10, 2),
    status VARCHAR(20) DEFAULT 'available'
);

INSERT INTO rooms (room_number, type, price) VALUES 
('101', 'Standard', 50.00),
('201', 'Deluxe', 120.00);
