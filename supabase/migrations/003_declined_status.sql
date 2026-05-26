-- Clean unsubscribed status — replace with declined
UPDATE prospects
SET status = 'declined'
WHERE status = 'unsubscribed';
