
-- 1. Create Courses Table
CREATE TABLE IF NOT EXISTS public.courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  class_name text,
  subject text,
  course_type text NOT NULL DEFAULT 'free'
    CHECK (course_type IN ('free', 'paid')),
  fee numeric(10,2) NOT NULL DEFAULT 0
    CHECK (fee >= 0),
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Create Enrollments Table
CREATE TABLE IF NOT EXISTS public.enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  payment_method text DEFAULT 'offline',
  fee_amount numeric(10,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(student_id, course_id)
);

-- 3. Enable Row Level Security
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;

-- 4. Course Policies
DROP POLICY IF EXISTS "Students view active courses" ON public.courses;
CREATE POLICY "Students view active courses"
ON public.courses FOR SELECT TO authenticated
USING (is_active = true);

DROP POLICY IF EXISTS "Admins manage courses" ON public.courses;
CREATE POLICY "Admins manage courses"
ON public.courses FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'super_admin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'super_admin')
  )
);

-- 5. Enrollment Policies
DROP POLICY IF EXISTS "Students view own enrollments" ON public.enrollments;
CREATE POLICY "Students view own enrollments"
ON public.enrollments FOR SELECT TO authenticated
USING (student_id = auth.uid());

DROP POLICY IF EXISTS "Admins manage enrollments" ON public.enrollments;
CREATE POLICY "Admins manage enrollments"
ON public.enrollments FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'super_admin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'super_admin')
  )
);

-- 6. Secure Enrollment Function
CREATE OR REPLACE FUNCTION public.request_course_enrollment(
  p_course_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student_id uuid;
  v_status text;
  v_fee numeric(10,2);
  v_enrollment_id uuid;
BEGIN
  v_student_id := auth.uid();

  IF v_student_id IS NULL THEN
    RAISE EXCEPTION 'Please login first';
  END IF;

  SELECT fee, course_type
  INTO v_fee, v_status
  FROM public.courses
  WHERE id = p_course_id AND is_active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Course not found or inactive';
  END IF;

  IF v_status = 'free' THEN
    v_status := 'approved';
    v_fee := 0;
  ELSE
    v_status := 'pending';
  END IF;

  INSERT INTO public.enrollments
    (student_id, course_id, status, payment_method, fee_amount)
  VALUES
    (v_student_id, p_course_id, v_status, 'offline', v_fee)
  ON CONFLICT (student_id, course_id) DO NOTHING
  RETURNING id INTO v_enrollment_id;

  IF v_enrollment_id IS NULL THEN
    SELECT id INTO v_enrollment_id
    FROM public.enrollments
    WHERE student_id = v_student_id
      AND course_id = p_course_id;
  END IF;

  RETURN v_enrollment_id;
END;
$$;

REVOKE ALL ON FUNCTION public.request_course_enrollment(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_course_enrollment(uuid) TO authenticated;

-- 7. Table Permissions
GRANT SELECT, INSERT, UPDATE, DELETE
ON public.courses TO authenticated;

GRANT SELECT, UPDATE, DELETE
ON public.enrollments TO authenticated;
