-- ========================================================================
-- OURSPACE: Migration 002 - Comprehensive Row Level Security (RLS) Policies
-- ========================================================================

-- Helper Function: Check if the calling user belongs to a private space
CREATE OR REPLACE FUNCTION public.is_member_of_space(p_space_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.space_members
        WHERE space_id = p_space_id AND user_id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- 1. Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.private_spaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.space_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_deletions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.typing_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shared_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.albums ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- 2. Profiles Policies
CREATE POLICY "Profiles viewable by authenticated users"
    ON public.profiles FOR SELECT
    TO authenticated
    USING (TRUE);

CREATE POLICY "Users can update own profile"
    ON public.profiles FOR UPDATE
    TO authenticated
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- 3. Private Spaces Policies
CREATE POLICY "Spaces viewable by members"
    ON public.private_spaces FOR SELECT
    TO authenticated
    USING (public.is_member_of_space(id));

CREATE POLICY "Authenticated users can create a space"
    ON public.private_spaces FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Members can update their space"
    ON public.private_spaces FOR UPDATE
    TO authenticated
    USING (public.is_member_of_space(id))
    WITH CHECK (public.is_member_of_space(id));

CREATE POLICY "Creator can delete space"
    ON public.private_spaces FOR DELETE
    TO authenticated
    USING (auth.uid() = created_by);

-- 4. Space Members Policies
CREATE POLICY "Members can view space co-members"
    ON public.space_members FOR SELECT
    TO authenticated
    USING (public.is_member_of_space(space_id));

CREATE POLICY "Creator can add themselves or accept invites"
    ON public.space_members FOR INSERT
    TO authenticated
    WITH CHECK (
        auth.uid() = user_id
    );

CREATE POLICY "Members can leave or unpair"
    ON public.space_members FOR DELETE
    TO authenticated
    USING (public.is_member_of_space(space_id));

-- 5. Invitations Policies
CREATE POLICY "Members can view invitations for their space"
    ON public.invitations FOR SELECT
    TO authenticated
    USING (
        public.is_member_of_space(space_id)
        OR (status = 'pending' AND expires_at > NOW())
    );

CREATE POLICY "Space members can create invitations"
    ON public.invitations FOR INSERT
    TO authenticated
    WITH CHECK (
        public.is_member_of_space(space_id)
        AND auth.uid() = created_by
    );

CREATE POLICY "Authenticated users can accept pending invitations"
    ON public.invitations FOR UPDATE
    TO authenticated
    USING (status = 'pending' AND expires_at > NOW())
    WITH CHECK (status IN ('accepted', 'revoked'));

-- 6. Conversations Policies
CREATE POLICY "Conversations viewable by space members"
    ON public.conversations FOR SELECT
    TO authenticated
    USING (public.is_member_of_space(space_id));

CREATE POLICY "Space members can create conversations"
    ON public.conversations FOR INSERT
    TO authenticated
    WITH CHECK (public.is_member_of_space(space_id));

-- 7. Messages Policies
CREATE POLICY "Messages viewable by space members"
    ON public.messages FOR SELECT
    TO authenticated
    USING (
        public.is_member_of_space(space_id)
        AND NOT EXISTS (
            SELECT 1 FROM public.message_deletions md
            WHERE md.message_id = messages.id AND md.user_id = auth.uid()
        )
    );

CREATE POLICY "Space members can send messages"
    ON public.messages FOR INSERT
    TO authenticated
    WITH CHECK (
        public.is_member_of_space(space_id)
        AND auth.uid() = sender_id
    );

CREATE POLICY "Senders can edit or delete their messages"
    ON public.messages FOR UPDATE
    TO authenticated
    USING (
        public.is_member_of_space(space_id)
        AND (auth.uid() = sender_id OR pinned IS NOT NULL)
    );

-- 8. Message Deletions Policies ("Delete for me")
CREATE POLICY "Users can manage their message deletions"
    ON public.message_deletions FOR ALL
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- 9. Message Reactions Policies
CREATE POLICY "Space members can view reactions"
    ON public.message_reactions FOR SELECT
    TO authenticated
    USING (public.is_member_of_space(space_id));

CREATE POLICY "Space members can add reactions"
    ON public.message_reactions FOR INSERT
    TO authenticated
    WITH CHECK (
        public.is_member_of_space(space_id)
        AND auth.uid() = user_id
    );

CREATE POLICY "Users can remove their own reactions"
    ON public.message_reactions FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);

-- 10. Message Attachments Policies
CREATE POLICY "Space members can view attachments"
    ON public.message_attachments FOR SELECT
    TO authenticated
    USING (public.is_member_of_space(space_id));

CREATE POLICY "Space members can create attachments"
    ON public.message_attachments FOR INSERT
    TO authenticated
    WITH CHECK (public.is_member_of_space(space_id));

-- 11. Message Receipts Policies
CREATE POLICY "Space members can view receipts"
    ON public.message_receipts FOR SELECT
    TO authenticated
    USING (public.is_member_of_space(space_id));

CREATE POLICY "Users can upsert receipts for themselves"
    ON public.message_receipts FOR ALL
    TO authenticated
    USING (public.is_member_of_space(space_id) AND auth.uid() = user_id)
    WITH CHECK (public.is_member_of_space(space_id) AND auth.uid() = user_id);

-- 12. Typing States Policies
CREATE POLICY "Space members can view typing states"
    ON public.typing_states FOR SELECT
    TO authenticated
    USING (public.is_member_of_space(space_id));

CREATE POLICY "Users can update their own typing state"
    ON public.typing_states FOR ALL
    TO authenticated
    USING (public.is_member_of_space(space_id) AND auth.uid() = user_id)
    WITH CHECK (public.is_member_of_space(space_id) AND auth.uid() = user_id);

-- 13. Devices & Notifications Policies
CREATE POLICY "Users manage their own devices"
    ON public.user_devices FOR ALL
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users manage their notification preferences"
    ON public.notification_preferences FOR ALL
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- 14. Reminders Policies
CREATE POLICY "Space members can view reminders"
    ON public.reminders FOR SELECT
    TO authenticated
    USING (public.is_member_of_space(space_id));

CREATE POLICY "Space members can create reminders"
    ON public.reminders FOR INSERT
    TO authenticated
    WITH CHECK (public.is_member_of_space(space_id) AND auth.uid() = created_by);

CREATE POLICY "Space members can update reminders"
    ON public.reminders FOR UPDATE
    TO authenticated
    USING (public.is_member_of_space(space_id))
    WITH CHECK (public.is_member_of_space(space_id));

CREATE POLICY "Space members can delete reminders"
    ON public.reminders FOR DELETE
    TO authenticated
    USING (public.is_member_of_space(space_id));

-- 15. Shared Events Policies
CREATE POLICY "Space members can view shared events"
    ON public.shared_events FOR SELECT
    TO authenticated
    USING (public.is_member_of_space(space_id));

CREATE POLICY "Space members can create shared events"
    ON public.shared_events FOR INSERT
    TO authenticated
    WITH CHECK (public.is_member_of_space(space_id) AND auth.uid() = created_by);

CREATE POLICY "Space members can update shared events"
    ON public.shared_events FOR UPDATE
    TO authenticated
    USING (public.is_member_of_space(space_id));

CREATE POLICY "Space members can delete shared events"
    ON public.shared_events FOR DELETE
    TO authenticated
    USING (public.is_member_of_space(space_id));

-- 16. Media Files & Albums Policies
CREATE POLICY "Space members can view media files"
    ON public.media_files FOR SELECT
    TO authenticated
    USING (public.is_member_of_space(space_id));

CREATE POLICY "Space members can upload media files"
    ON public.media_files FOR INSERT
    TO authenticated
    WITH CHECK (public.is_member_of_space(space_id) AND auth.uid() = uploaded_by);

CREATE POLICY "Space members can update media files (favourite, caption)"
    ON public.media_files FOR UPDATE
    TO authenticated
    USING (public.is_member_of_space(space_id));

CREATE POLICY "Uploaders can delete media files"
    ON public.media_files FOR DELETE
    TO authenticated
    USING (public.is_member_of_space(space_id) AND auth.uid() = uploaded_by);

CREATE POLICY "Space members can view and manage albums"
    ON public.albums FOR ALL
    TO authenticated
    USING (public.is_member_of_space(space_id))
    WITH CHECK (public.is_member_of_space(space_id));

-- 17. Call Sessions Policies
CREATE POLICY "Space members can view and manage calls"
    ON public.call_sessions FOR ALL
    TO authenticated
    USING (public.is_member_of_space(space_id))
    WITH CHECK (public.is_member_of_space(space_id));

-- 18. Audit Logs Policies
CREATE POLICY "Space members can view audit logs"
    ON public.audit_logs FOR SELECT
    TO authenticated
    USING (public.is_member_of_space(space_id));

CREATE POLICY "Authenticated users can record audit actions"
    ON public.audit_logs FOR INSERT
    TO authenticated
    WITH CHECK (public.is_member_of_space(space_id));
