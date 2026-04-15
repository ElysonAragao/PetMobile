-- Migration: Add is_urgency column to pet_exames table
-- Description: Allows identifying exams that can be requested as urgent.

ALTER TABLE pet_exames 
ADD COLUMN is_urgency BOOLEAN DEFAULT FALSE;

-- Optional: Comments for documentation
COMMENT ON COLUMN pet_exames.is_urgency IS 'Indicates if the exam is considered high priority/urgent for the veterinary clinic.';

-- Verification
-- SELECT nome, is_urgency FROM pet_exames LIMIT 5;
