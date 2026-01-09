Database Schema (ERD)

This document describes the data structure for NexStay OS. 
The visual diagram can be found here: https://dbdiagram.io/d/69618669d6e030a0249db386

## Main Entities:
* **Users:** System actors (Admin, Manager, Cleaner).
* **Rooms:** Physical assets of the hotel.
* **Bookings:** Guest reservations linked to rooms.
* **CleaningTasks:** Service workflow triggered by check-outs.

(Relationships)
Many bookings for one room
Many cleaning tasks for one room
Many tasks for one cleaner
