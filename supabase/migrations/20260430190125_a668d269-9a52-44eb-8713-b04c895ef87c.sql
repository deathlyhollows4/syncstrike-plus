ALTER TABLE public.chat_messages ADD CONSTRAINT chat_messages_body_len_chk CHECK (char_length(body) BETWEEN 1 AND 2000);
ALTER TABLE public.tasks ADD CONSTRAINT tasks_title_len_chk CHECK (char_length(title) BETWEEN 1 AND 255);
ALTER TABLE public.tasks ADD CONSTRAINT tasks_description_len_chk CHECK (description IS NULL OR char_length(description) <= 5000);
ALTER TABLE public.tasks ADD CONSTRAINT tasks_completion_description_len_chk CHECK (completion_description IS NULL OR char_length(completion_description) <= 5000);
ALTER TABLE public.tasks ADD CONSTRAINT tasks_blocker_reason_len_chk CHECK (blocker_reason IS NULL OR char_length(blocker_reason) <= 2000);
ALTER TABLE public.profiles ADD CONSTRAINT profiles_display_name_len_chk CHECK (display_name IS NULL OR char_length(display_name) <= 100);
ALTER TABLE public.profiles ADD CONSTRAINT profiles_avatar_url_len_chk CHECK (avatar_url IS NULL OR char_length(avatar_url) <= 500);
ALTER TABLE public.profiles ADD CONSTRAINT profiles_email_len_chk CHECK (char_length(email) BETWEEN 3 AND 255);