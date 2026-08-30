import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://mkebvoyekvvrxklisgzj.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1rZWJ2b3lla3Z2cnhrbGlzZ3pqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY5MDI2NjAsImV4cCI6MjEwMjQ3ODY2MH0.YDWS5m4TadVQM7tcYIQ9sEdq1SLzwqXBn9nC2dmoqB8';

export const supabase = createClient(supabaseUrl, supabaseKey);