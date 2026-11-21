
import { useEffect, useState } from 'react';
import { supabase } from './lib/supabase';

type LiveClass = {
  id: string;
  title: string;
  description: string | null;
  class_name: string;
  subject: string;
  teacher_name: string | null;
  scheduled_at: string;
  youtube_live_url: string | null;
  recording_url: string | null;
  status: 'scheduled' | 'live' | 'completed' | 'cancelled';
  is_published: boolean;
};

const emptyForm = {
  title: '',
  description: '',
  class_name: 'Class 10th',
  subject: '',
  teacher_name: '',
  scheduled_at: '',
  youtube_live_url: '',
  recording_url: '',
  status: 'scheduled' as LiveClass['status'],
  is_published: true,
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '12px',
  marginTop: '6px',
  marginBottom: '12px',
  border: '1px solid #d5dbea',
  borderRadius: '10px',
  fontSize: '14px',
  boxSizing: 'border-box',
  background: '#fff',
  color: '#17233d',
};

const buttonStyle: React.CSSProperties = {
  padding: '11px 16px',
  border: 0,
  borderRadius: '10px',
  background: '#102b55',
  color: '#fff',
  fontWeight: 700,
  cursor: 'pointer',
};

export default function LiveClasses() {
  const [classes, setClasses] = useState<LiveClass[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  async function loadClasses() {
    if (!supabase) {
      setError('Supabase configuration नहीं मिली।');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');

    const { data: authData } = await supabase.auth.getUser();
    const user = authData.user;

    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle();

      setIsAdmin(
        profile?.role === 'admin' || profile?.role === 'super_admin'
      );
    } else {
      setIsAdmin(false);
    }

    const { data, error: fetchError } = await supabase
      .from('live_classes')
      .select('*')
      .order('scheduled_at', { ascending: true });

    if (fetchError) {
      setError(fetchError.message);
    } else {
      setClasses((data || []) as LiveClass[]);
    }

    setLoading(false);
  }

  useEffect(() => {
    loadClasses();
  }, []);

  function updateField(name: string, value: string | boolean) {
    setForm(prev => ({ ...prev, [name]: value }));
  }

  function startEdit(item: LiveClass) {
    setEditingId(item.id);
    setForm({
      title: item.title,
      description: item.description || '',
      class_name: item.class_name,
      subject: item.subject,
      teacher_name: item.teacher_name || '',
      scheduled_at: new Date(item.scheduled_at).toISOString().slice(0, 16),
      youtube_live_url: item.youtube_live_url || '',
      recording_url: item.recording_url || '',
      status: item.status,
      is_published: item.is_published,
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm);
  }

  async function saveClass(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!supabase) return;
    if (!form.title.trim() || !form.subject.trim() || !form.scheduled_at) {
      setError('Title, Subject और Date/Time भरना जरूरी है।');
      return;
    }

    setSaving(true);
    setError('');

    const { data: authData } = await supabase.auth.getUser();
    const payload = {
      ...form,
      scheduled_at: new Date(form.scheduled_at).toISOString(),
      description: form.description || null,
      teacher_name: form.teacher_name || null,
      youtube_live_url: form.youtube_live_url || null,
      recording_url: form.recording_url || null,
    };

    const result = editingId
      ? await supabase
          .from('live_classes')
          .update(payload)
          .eq('id', editingId)
      : await supabase
          .from('live_classes')
          .insert({
            ...payload,
            created_by: authData.user?.id,
          });

    if (result.error) {
      setError(result.error.message);
    } else {
      resetForm();
      await loadClasses();
    }

    setSaving(false);
  }

  async function deleteClass(id: string) {
    if (!supabase) return;
    if (!window.confirm('क्या आप यह Live Class delete करना चाहते हैं?')) return;

    const { error: deleteError } = await supabase
      .from('live_classes')
      .delete()
      .eq('id', id);

    if (deleteError) {
      setError(deleteError.message);
    } else {
      await loadClasses();
    }
  }

  function formatDate(date: string) {
    return new Date(date).toLocaleString('en-IN', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  }

  function statusLabel(status: LiveClass['status']) {
    if (status === 'live') return '🔴 LIVE NOW';
    if (status === 'completed') return '✅ Completed';
    if (status === 'cancelled') return '❌ Cancelled';
    return '🕒 Upcoming';
  }

  return (
    <div style={{
      maxWidth: 900,
      margin: '0 auto',
      padding: '16px',
      color: '#17233d',
    }}>
      <div style={{
        background: 'linear-gradient(135deg,#10264b,#174477)',
        color: 'white',
        padding: '24px',
        borderRadius: 18,
        marginBottom: 20,
      }}>
        <div style={{ color: '#ffd45c', fontWeight: 800, fontSize: 12 }}>
          MASTER MIND INSTITUTE
        </div>
        <h2 style={{ margin: '8px 0', fontSize: 25 }}>
          Live Classes & Recordings
        </h2>
        <p style={{ margin: 0, opacity: 0.9 }}>
          Join live lessons and watch recorded lectures anytime.
        </p>
      </div>

      {error && (
        <div style={{
          padding: 12,
          marginBottom: 16,
          background: '#fff0f0',
          color: '#b42318',
          borderRadius: 10,
        }}>
          {error}
        </div>
      )}

      {isAdmin && (
        <section style={{
          background: '#fff',
          border: '1px solid #e3e8f0',
          borderRadius: 16,
          padding: 16,
          marginBottom: 22,
          boxShadow: '0 4px 18px #10264b0d',
        }}>
          <h3 style={{ marginTop: 0 }}>
            {editingId ? '✏️ Edit Live Class' : '➕ Schedule New Live Class'}
          </h3>

          <form onSubmit={saveClass}>
            <label>Class Title *</label>
            <input
              style={inputStyle}
              value={form.title}
              onChange={e => updateField('title', e.target.value)}
              placeholder="Example: Physics Chapter 1"
              required
            />

            <label>Class</label>
            <select
              style={inputStyle}
              value={form.class_name}
              onChange={e => updateField('class_name', e.target.value)}
            >
              {['Class 9th', 'Class 10th', 'Class 11th', 'Class 12th'].map(c => (
                <option key={c}>{c}</option>
              ))}
            </select>

            <label>Subject *</label>
            <input
              style={inputStyle}
              value={form.subject}
              onChange={e => updateField('subject', e.target.value)}
              placeholder="Physics / Maths / Biology"
              required
            />

            <label>Teacher Name</label>
            <input
              style={inputStyle}
              value={form.teacher_name}
              onChange={e => updateField('teacher_name', e.target.value)}
              placeholder="Teacher name"
            />

            <label>Class Date & Time *</label>
            <input
              style={inputStyle}
              type="datetime-local"
              value={form.scheduled_at}
              onChange={e => updateField('scheduled_at', e.target.value)}
              required
            />

            <label>YouTube Live URL</label>
            <input
              style={inputStyle}
              type="url"
              value={form.youtube_live_url}
              onChange={e => updateField('youtube_live_url', e.target.value)}
              placeholder="https://www.youtube.com/live/..."
            />

            <label>Recorded Video URL</label>
            <input
              style={inputStyle}
              type="url"
              value={form.recording_url}
              onChange={e => updateField('recording_url', e.target.value)}
              placeholder="https://www.youtube.com/watch?v=..."
            />

            <label>Description</label>
            <textarea
              style={{ ...inputStyle, minHeight: 75 }}
              value={form.description}
              onChange={e => updateField('description', e.target.value)}
              placeholder="Class details..."
            />

            <label>Class Status</label>
            <select
              style={inputStyle}
              value={form.status}
              onChange={e => updateField('status', e.target.value)}
            >
              <option value="scheduled">Upcoming / Scheduled</option>
              <option value="live">Live Now</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>

            <label style={{ display: 'flex', gap: 8, margin: '8px 0 16px' }}>
              <input
                type="checkbox"
                checked={form.is_published}
                onChange={e => updateField('is_published', e.target.checked)}
              />
              Show this class to students
            </label>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button style={buttonStyle} disabled={saving} type="submit">
                {saving ? 'Saving...' : editingId ? 'Update Class' : 'Schedule Class'}
              </button>
              {editingId && (
                <button
                  type="button"
                  style={{ ...buttonStyle, background: '#687386' }}
                  onClick={resetForm}
                >
                  Cancel Edit
                </button>
              )}
            </div>
          </form>
        </section>
      )}

      <h3>🔴 Live & Upcoming Classes</h3>

      {loading ? (
        <p>Loading classes...</p>
      ) : classes.filter(c => c.status !== 'completed').length === 0 ? (
        <p style={{ color: '#687386' }}>अभी कोई upcoming live class नहीं है।</p>
      ) : (
        classes.filter(c => c.status !== 'completed').map(item => (
          <article key={item.id} style={{
            background: '#fff',
            border: '1px solid #e3e8f0',
            borderRadius: 14,
            padding: 16,
            marginBottom: 14,
          }}>
            <div style={{ color: '#b07b00', fontWeight: 700, fontSize: 12 }}>
              {item.class_name} • {item.subject}
            </div>
            <h3 style={{ margin: '8px 0' }}>{item.title}</h3>
            <p style={{ margin: '5px 0' }}>👨‍🏫 {item.teacher_name || 'Master Mind Faculty'}</p>
            <p style={{ margin: '5px 0' }}>📅 {formatDate(item.scheduled_at)}</p>
            <p style={{ margin: '8px 0', fontWeight: 700 }}>
              {statusLabel(item.status)}
            </p>
            {item.description && <p>{item.description}</p>}

            {item.youtube_live_url && item.status !== 'cancelled' && (
              <a
                href={item.youtube_live_url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  ...buttonStyle,
                  display: 'inline-block',
                  textDecoration: 'none',
                  background: '#d92332',
                  marginTop: 8,
                }}
              >
                ▶ Join YouTube Live
              </a>
            )}

            {isAdmin && (
              <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
                <button
                  style={buttonStyle}
                  onClick={() => startEdit(item)}
                >
                  Edit
                </button>
                <button
                  style={{ ...buttonStyle, background: '#b42318' }}
                  onClick={() => deleteClass(item.id)}
                >
                  Delete
                </button>
              </div>
            )}
          </article>
        ))
      )}

      <h3 style={{ marginTop: 28 }}>🎬 Recorded Lectures</h3>

      {classes.filter(c => c.recording_url && c.status !== 'cancelled').length === 0 ? (
        <p style={{ color: '#687386' }}>
          अभी कोई recorded lecture उपलब्ध नहीं है।
        </p>
      ) : (
        classes
          .filter(c => c.recording_url && c.status !== 'cancelled')
          .map(item => (
            <article key={item.id} style={{
              background: '#fff',
              border: '1px solid #e3e8f0',
              borderRadius: 14,
              padding: 16,
              marginBottom: 12,
            }}>
              <div style={{ color: '#b07b00', fontWeight: 700, fontSize: 12 }}>
                {item.class_name} • {item.subject}
              </div>
              <h3 style={{ margin: '8px 0' }}>{item.title}</h3>
              <p>👨‍🏫 {item.teacher_name || 'Master Mind Faculty'}</p>
              <a
                href={item.recording_url!}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  ...buttonStyle,
                  display: 'inline-block',
                  textDecoration: 'none',
                  background: '#16834a',
                }}
              >
                ▶ Watch Recording
              </a>
            </article>
          ))
      )}
    </div>
  );
}
