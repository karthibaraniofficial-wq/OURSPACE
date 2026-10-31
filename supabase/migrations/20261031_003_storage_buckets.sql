-- ========================================================================
-- OURSPACE: Migration 003 - Storage Buckets & Storage RLS Policies
-- ========================================================================

-- Insert private storage bucket if not already present
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'ourspace-media',
    'ourspace-media',
    FALSE, -- Strictly private: signed URLs or authenticated RLS required
    52428800, -- 50 MB per file limit
    ARRAY[
        'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic',
        'video/mp4', 'video/quicktime', 'video/webm',
        'application/pdf', 'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-powerpoint',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'text/plain', 'application/zip', 'audio/mpeg', 'audio/wav', 'audio/ogg'
    ]
)
ON CONFLICT (id) DO UPDATE SET
    public = FALSE,
    file_size_limit = 52428800;

-- Storage RLS: Users can only upload and read files within spaces they belong to
-- Storage objects path convention: {space_id}/{category}/{filename}

CREATE POLICY "Allow authenticated users to upload to their space folder"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (
        bucket_id = 'ourspace-media'
        AND public.is_member_of_space((storage.foldername(name))[1]::UUID)
    );

CREATE POLICY "Allow space members to download objects in their space"
    ON storage.objects FOR SELECT
    TO authenticated
    USING (
        bucket_id = 'ourspace-media'
        AND public.is_member_of_space((storage.foldername(name))[1]::UUID)
    );

CREATE POLICY "Allow uploaders or space members to delete objects in their space"
    ON storage.objects FOR DELETE
    TO authenticated
    USING (
        bucket_id = 'ourspace-media'
        AND public.is_member_of_space((storage.foldername(name))[1]::UUID)
    );
