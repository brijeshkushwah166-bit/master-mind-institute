
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { supabase } from './lib/supabase';

type Course = {
  id: string;
  title: string;
  description: string | null;
  class_name: string | null;
  subject: string | null;
  course_type: 'free' | 'paid';
  fee: number;
  is_active: boolean;
};

type Enrollment = {
  id: string;
  student_id: string;
  course_id: string;
  status: 'pending' | 'approved' | 'rejected';
  fee_amount: number;
  payment_method: string | null;
};

const styles = {
  card: {
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
    color: '#172554'
  } as const,
  button: {
    background: '#102c59',
    color: '#fff',
    border: 0,
    borderRadius: 9,
    padding: '11px 16px',
    cursor: 'pointer',
    fontWeight: 600
  } as const,
  input: {
    width: '100%',
    boxSizing: 'border-box' as const,
    padding: 11,
    border: '1px solid #cbd5e1',
    borderRadius: 8,
    marginTop: 6,
    marginBottom: 12,
    fontSize: 15
  } as const
};

export default function Courses() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userId, setUserId] = useState('');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [className, setClassName] = useState('Class 9th');
  const [subject, setSubject] = useState('');
  const [courseType, setCourseType] = useState<'free' | 'paid'>('free');
  const [fee, setFee] = useState('0');

  async function loadData() {
    if (!supabase) {
      setMessage('Supabase connection is not configured.');
      setLoading(false);
      return;
    }

    setLoading(true);

    const { data: sessionData } = await supabase.auth.getSession();
    const user = sessionData.session?.user;

    if (!user) {
      setMessage('Please login to view courses.');
      setLoading(false);
      return;
    }

    setUserId(user.id);

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    const admin = profile?.role === 'admin' || profile?.role === 'super_admin';
    setIsAdmin(admin);

    const { data: courseData, error: courseError } = await supabase
      .from('courses')
      .select('*')
      .order('created_at', { ascending: false });

    if (courseError) {
      setMessage(courseError.message);
      setLoading(false);
      return;
    }

    setCourses((courseData || []) as Course[]);

    const enrollmentQuery = supabase
      .from('enrollments')
      .select('*')
      .order('created_at', { ascending: false });

    const { data: enrollmentData, error: enrollmentError } = await enrollmentQuery;

    if (enrollmentError) {
      setMessage(enrollmentError.message);
    } else {
      setEnrollments((enrollmentData || []) as Enrollment[]);
    }

    setLoading(false);
  }

  useEffect(() => {
    void loadData();
  }, []);

  async function enroll(course: Course) {
    if (!supabase || !userId) {
      setMessage('Please login first.');
      return;
    }

    setSaving(true);
    setMessage('');

    const { error } = await supabase.rpc('request_course_enrollment', {
      p_course_id: course.id
    });

    if (error) {
      setMessage(error.message);
    } else {
      setMessage(
        course.course_type === 'free'
          ? 'Free course enrollment successful!'
          : 'Enrollment request submitted. Admin approval is pending.'
      );
      await loadData();
    }

    setSaving(false);
  }

  async function addCourse(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!supabase) return;

    if (!title.trim()) {
      setMessage('Please enter course title.');
      return;
    }

    const amount = courseType === 'free' ? 0 : Number(fee);

    if (!Number.isFinite(amount) || amount < 0) {
      setMessage('Please enter a valid course fee.');
      return;
    }

    setSaving(true);
    setMessage('');

    const { error } = await supabase.from('courses').insert({
      title: title.trim(),
      description: description.trim(),
      class_name: className,
      subject: subject.trim(),
      course_type: courseType,
      fee: amount,
      is_active: true,
      created_by: userId
    });

    if (error) {
      setMessage(error.message);
    } else {
      setMessage('Course added successfully!');
      setTitle('');
      setDescription('');
      setSubject('');
      setCourseType('free');
      setFee('0');
      await loadData();
    }

    setSaving(false);
  }

  async function updateEnrollment(id: string, status: 'approved' | 'rejected') {
    if (!supabase) return;

    setSaving(true);
    setMessage('');

    const { error } = await supabase
      .from('enrollments')
      .update({ status })
      .eq('id', id);

    if (error) {
      setMessage(error.message);
    } else {
      setMessage(`Enrollment ${status} successfully.`);
      await loadData();
    }

    setSaving(false);
  }

  async function toggleCourse(course: Course) {
    if (!supabase) return;

    const { error } = await supabase
      .from('courses')
      .update({ is_active: !course.is_active })
      .eq('id', course.id);

    if (error) {
      setMessage(error.message);
    } else {
      setMessage(course.is_active ? 'Course deactivated.' : 'Course activated.');
      await loadData();
    }
  }

  function statusColor(status: string) {
    if (status === 'approved') return '#15803d';
    if (status === 'rejected') return '#dc2626';
    return '#b45309';
  }

  if (loading) {
    return <div style={{ padding: 20 }}>Loading courses...</div>;
  }

  if (!userId) {
    return (
      <section style={{ padding: 20 }}>
        <h2>Our Courses</h2>
        <p>{message || 'Please login to view courses.'}</p>
      </section>
    );
  }

  return (
    <section style={{ padding: 16, color: '#102c59' }}>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ marginBottom: 5 }}>Master Mind Courses</h2>
        <p style={{ color: '#64748b', marginTop: 0 }}>
          Learn More. Achieve More.
        </p>
      </div>

      {message && (
        <div
          role="status"
          style={{
            ...styles.card,
            background: '#f8fafc',
            overflowWrap: 'anywhere'
          }}
        >
          {message}
        </div>
      )}

      {isAdmin && (
        <div style={styles.card}>
          <h3>Add New Course</h3>

          <form onSubmit={addCourse}>
            <label>Course Title</label>
            <input
              style={styles.input}
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Example: Class 10th Complete Course"
              required
            />

            <label>Description</label>
            <textarea
              style={styles.input}
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Course details"
              rows={3}
            />

            <label>Class</label>
            <select
              style={styles.input}
              value={className}
              onChange={e => setClassName(e.target.value)}
            >
              <option>Class 9th</option>
              <option>Class 10th</option>
              <option>Class 11th</option>
              <option>Class 12th</option>
            </select>

            <label>Subject</label>
            <input
              style={styles.input}
              value={subject}
              onChange={e => setSubject(e.target.value)}
              placeholder="Maths, Science, Physics..."
            />

            <label>Course Type</label>
            <select
              style={styles.input}
              value={courseType}
              onChange={e => setCourseType(e.target.value as 'free' | 'paid')}
            >
              <option value="free">Free Course</option>
              <option value="paid">Paid Course</option>
            </select>

            {courseType === 'paid' && (
              <>
                <label>Course Fee (₹)</label>
                <input
                  style={styles.input}
                  type="number"
                  min="1"
                  value={fee}
                  onChange={e => setFee(e.target.value)}
                  required
                />
              </>
            )}

            <button style={styles.button} disabled={saving} type="submit">
              {saving ? 'Please wait...' : 'Add Course'}
            </button>
          </form>
        </div>
      )}

      <h3>Available Courses</h3>

      {courses.filter(course => course.is_active).length === 0 && (
        <div style={styles.card}>No courses available yet.</div>
      )}

      {courses.filter(course => course.is_active).map(course => {
        const enrollment = enrollments.find(
          item => item.course_id === course.id && item.student_id === userId
        );

        return (
          <article key={course.id} style={styles.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
              <h3 style={{ marginTop: 0 }}>{course.title}</h3>
              <span
                style={{
                  color: course.course_type === 'free' ? '#15803d' : '#b45309',
                  fontWeight: 700,
                  whiteSpace: 'nowrap'
                }}
              >
                {course.course_type === 'free' ? 'FREE' : `₹${course.fee}`}
              </span>
            </div>

            <p style={{ color: '#64748b' }}>
              {course.class_name} {course.subject ? `• ${course.subject}` : ''}
            </p>

            {course.description && <p>{course.description}</p>}

            {enrollment ? (
              <p style={{ color: statusColor(enrollment.status), fontWeight: 700 }}>
                Enrollment: {enrollment.status.toUpperCase()}
              </p>
            ) : (
              <button
                style={styles.button}
                disabled={saving}
                onClick={() => void enroll(course)}
              >
                {course.course_type === 'free' ? 'Enroll Free' : 'Request Enrollment'}
              </button>
            )}

            {isAdmin && (
              <button
                style={{ ...styles.button, background: '#64748b', marginLeft: 8 }}
                onClick={() => void toggleCourse(course)}
              >
                Deactivate
              </button>
            )}
          </article>
        );
      })}

      {isAdmin && (
        <>
          <h3 style={{ marginTop: 28 }}>Enrollment Requests</h3>

          {enrollments.length === 0 && (
            <div style={styles.card}>No enrollment requests yet.</div>
          )}

          {enrollments.map(item => {
            const course = courses.find(c => c.id === item.course_id);

            return (
              <div key={item.id} style={styles.card}>
                <strong>{course?.title || 'Course'}</strong>
                <p>Student ID: {item.student_id}</p>
                <p>Fee: ₹{item.fee_amount}</p>
                <p>
                  Status:{' '}
                  <span style={{ color: statusColor(item.status), fontWeight: 700 }}>
                    {item.status.toUpperCase()}
                  </span>
                </p>

                {item.status === 'pending' && (
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button
                      style={{ ...styles.button, background: '#15803d' }}
                      disabled={saving}
                      onClick={() => void updateEnrollment(item.id, 'approved')}
                    >
                      Approve
                    </button>
                    <button
                      style={{ ...styles.button, background: '#dc2626' }}
                      disabled={saving}
                      onClick={() => void updateEnrollment(item.id, 'rejected')}
                    >
                      Reject
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </>
      )}
    </section>
  );
}
