
import LiveClasses from './LiveClasses';
import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import {
  BookOpen, GraduationCap, FileText, Video, Search,
  LogIn, LogOut, Upload, Plus, Trash2, ExternalLink,
  Globe, ShieldCheck, Download, Pencil, Home, User,
  Layers, ChevronRight, Sparkles, X
} from 'lucide-react';
import { isSupabaseConfigured, supabase } from './lib/supabase';
import Courses from './Courses';

type Material = {
  id: string;
  title: string;
  description: string | null;
  class_level: string;
  subject: string;
  material_type: 'lecture' | 'notes' | 'dpp' | 'pyq' | 'other';
  file_url: string | null;
  storage_path: string | null;
  is_published: boolean;
  created_at: string;
};

type Profile = {
  id: string;
  full_name: string | null;
  role: string;
};

type Page = 'home' | 'courses' | 'study' | 'live' | 'profile';

export default function App() {
  const [lang, setLang] = useState<'en' | 'hi'>('en');
  const [session, setSession] = useState<any>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [page, setPage] = useState<Page>('home');
  const [query, setQuery] = useState('');
  const [cls, setCls] = useState('all');
  const [kind, setKind] = useState('all');

  const [authOpen, setAuthOpen] = useState(false);
  const [signup, setSignup] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [editing, setEditing] = useState<Material | null>(null);

  const [form, setForm] = useState({
    title: '',
    description: '',
    class_level: '10',
    subject: 'Science',
    material_type: 'notes' as Material['material_type'],
    file_url: ''
  });

  const [file, setFile] = useState<File | null>(null);

  const hindi = lang === 'hi';
  const isAdmin =
    profile?.role === 'admin' ||
    profile?.role === 'super_admin';

  useEffect(() => {
    if (!supabase) return;

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
    });

    const { data: { subscription } } =
      supabase.auth.onAuthStateChange((_event, newSession) => {
        setSession(newSession);
      });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    async function loadProfile() {
      if (!session?.user || !supabase) {
        setProfile(null);
        return;
      }

      const { data } = await supabase
        .from('profiles')
        .select('id,full_name,role')
        .eq('id', session.user.id)
        .maybeSingle();

      setProfile(data as Profile | null);
    }

    loadProfile();
  }, [session]);

  async function loadMaterials() {
    if (!supabase) return;

    const { data, error } = await supabase
      .from('study_materials')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) setMessage(error.message);
    else setMaterials((data || []) as Material[]);
  }

  useEffect(() => {
    void loadMaterials();
  }, []);

  const filtered = useMemo(() => {
    return materials.filter(m =>
      (cls === 'all' || m.class_level === cls) &&
      (kind === 'all' || m.material_type === kind) &&
      `${m.title} ${m.subject} ${m.description || ''}`
        .toLowerCase()
        .includes(query.toLowerCase())
    );
  }, [materials, cls, kind, query]);

  async function authSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!supabase) return;

    setBusy(true);
    setMessage('');

    const fd = new FormData(e.currentTarget);
    const email = String(fd.get('email'));
    const password = String(fd.get('password'));

    const result = signup
      ? await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: String(fd.get('name') || 'Student')
            }
          }
        })
      : await supabase.auth.signInWithPassword({
          email,
          password
        });

    setBusy(false);

    if (result.error) {
      setMessage(result.error.message);
    } else {
      setAuthOpen(false);
      setMessage(
        signup
          ? 'Account created. Please verify your email if required.'
          : 'Welcome back!'
      );
    }
  }

  async function signOut() {
    await supabase?.auth.signOut();
    setPage('home');
  }

  function resetForm() {
    setForm({
      title: '',
      description: '',
      class_level: '10',
      subject: 'Science',
      material_type: 'notes',
      file_url: ''
    });
    setFile(null);
    setEditing(null);
  }

  async function saveMaterial(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!supabase || !isAdmin || !session?.user) return;

    setBusy(true);
    setMessage('');

    let storage_path = editing?.storage_path || null;
    let file_url = form.file_url.trim() || editing?.file_url || null;

    if (file) {
      const path = `${form.class_level}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;

      const { error: uploadError } = await supabase.storage
        .from('study-materials')
        .upload(path, file, { upsert: false });

      if (uploadError) {
        setBusy(false);
        setMessage(uploadError.message);
        return;
      }

      storage_path = path;
      file_url = supabase.storage
        .from('study-materials')
        .getPublicUrl(path).data.publicUrl;
    }

    const payload = {
      ...form,
      storage_path,
      file_url,
      created_by: session.user.id,
      is_published: true
    };

    const result = editing
      ? await supabase.from('study_materials')
          .update(payload).eq('id', editing.id)
      : await supabase.from('study_materials').insert(payload);

    setBusy(false);

    if (result.error) {
      setMessage(result.error.message);
      return;
    }

    resetForm();
    setAdminOpen(false);
    await loadMaterials();
    setMessage('Study material saved successfully.');
  }

  async function deleteMaterial(m: Material) {
    if (!supabase || !isAdmin ||
      !window.confirm(`Delete "${m.title}"?`)) return;

    const { error } = await supabase
      .from('study_materials')
      .delete()
      .eq('id', m.id);

    if (error) {
      setMessage(error.message);
      return;
    }

    if (m.storage_path) {
      await supabase.storage
        .from('study-materials')
        .remove([m.storage_path]);
    }

    await loadMaterials();
  }

  function editMaterial(m: Material) {
    setEditing(m);
    setForm({
      title: m.title,
      description: m.description || '',
      class_level: m.class_level,
      subject: m.subject,
      material_type: m.material_type,
      file_url: m.file_url || ''
    });
    setFile(null);
    setAdminOpen(true);
  }

  const labels = {
    home: hindi ? 'होम' : 'Home',
    courses: hindi ? 'कोर्स' : 'Courses',
    study: hindi ? 'स्टडी' : 'Study',
    live: hindi ? 'लाइव' : 'Live',
    profile: hindi ? 'प्रोफाइल' : 'Profile'
  };

  if (!isSupabaseConfigured) {
    return (
      <main className="setup">
        <h1>MASTER MIND INSTITUTE</h1>
        <p>Supabase connection is required.</p>
      </main>
    );
  }

  return (
    <div className="app premiumApp">
      <header className="topbar">
        <a className="brand" href="#" onClick={e => {
          e.preventDefault();
          setPage('home');
        }}>
          <div className="logoMark">
            <img src="/logo.png" alt="Master Mind Institute" />
          </div>
          <div>
            <strong>MASTER MIND</strong>
            <small>INSTITUTE · CLASS 9th–12th</small>
          </div>
        </a>

        <nav>
          <button className="plain lang"
            onClick={() => setLang(lang === 'en' ? 'hi' : 'en')}>
            <Globe size={17} />
            {hindi ? 'English' : 'हिन्दी'}
          </button>

          {session ? (
            <button className="outline" onClick={signOut}>
              <LogOut size={16} />
              Logout
            </button>
          ) : (
            <button className="gold" onClick={() => setAuthOpen(true)}>
              <LogIn size={16} />
              Login
            </button>
          )}
        </nav>
      </header>

      <div className="welcomeStrip">
        <Sparkles size={16} />
        {hindi
          ? 'आपका लक्ष्य, हमारी जिम्मेदारी'
          : 'Your Goal. Our Guidance. Your Success.'}
      </div>

      {page === 'home' && (
        <>
          <section className="hero premiumHero">
            <div className="heroContent">
              <span className="eyebrow">✦ DREAM BIG · ACHIEVE MORE</span>
              <h1>
                Learn Today.
                <br />
                <span>Lead Tomorrow.</span>
              </h1>
              <p>
                {hindi
                  ? 'कक्षा 9वीं से 12वीं तक शानदार पढ़ाई और बेहतर भविष्य की तैयारी।'
                  : 'Your complete learning destination for Classes 9th to 12th.'}
              </p>

              <div className="heroButtons">
                <button className="gold" onClick={() => setPage('courses')}>
                  Explore Courses <ChevronRight size={18} />
                </button>
                <button className="outline" onClick={() => setPage('study')}>
                  Study Material
                </button>
              </div>

              <div className="heroPills">
                <span><ShieldCheck size={16} /> Expert Learning</span>
                <span><BookOpen size={16} /> Notes & DPP</span>
              </div>
            </div>
          </section>

          <main className="main">
            <div className="sectionHead">
              <div>
                <span className="eyebrow dark">LEARN · PRACTICE · ACHIEVE</span>
                <h2>{hindi ? 'अपनी कक्षा चुनें' : 'Choose Your Class'}</h2>
              </div>
            </div>

            <div className="classGrid">
              {['9', '10', '11', '12'].map(n => (
                <button key={n} className="classTile" onClick={() => {
                  setCls(n);
                  setPage('study');
                }}>
                  <span>CLASS</span>
                  <b>{n}<sup>th</sup></b>
                  <ChevronRight size={18} />
                </button>
              ))}
            </div>

            <div className="featureGrid">
              <button className="featureCard" onClick={() => setPage('courses')}>
                <div className="featureIcon"><GraduationCap /></div>
                <h3>Explore Courses</h3>
                <p>Free & paid learning programs</p>
                <ChevronRight />
              </button>

              <button className="featureCard" onClick={() => setPage('study')}>
                <div className="featureIcon"><FileText /></div>
                <h3>Study Material</h3>
                <p>Notes, DPP, PYQ and lectures</p>
                <ChevronRight />
              </button>

              <button className="featureCard" onClick={() => setPage('live')}>
                <div className="featureIcon"><Video /></div>
                <h3>Live Classes</h3>
                <p>Learn with your teachers</p>
                <ChevronRight />
              </button>

              <button className="featureCard" onClick={() => setPage('profile')}>
                <div className="featureIcon"><User /></div>
                <h3>My Account</h3>
                <p>Manage your student account</p>
                <ChevronRight />
              </button>
            </div>
          </main>
        </>
      )}

      {page === 'courses' && (
        <main className="main pageMain">
          <div className="sectionHead">
            <div>
              <span className="eyebrow dark">MASTER MIND LEARNING</span>
              <h2>Our Courses</h2>
              <p>Choose your course and start learning.</p>
            </div>
          </div>
          <Courses />
        </main>
      )}

      {page === 'study' && (
        <main className="main pageMain">
          <div className="sectionHead">
            <div>
              <span className="eyebrow dark">LEARN · PRACTICE · REVISE</span>
              <h2>{hindi ? 'स्टडी मटेरियल' : 'Study Material'}</h2>
            </div>

            {isAdmin && (
              <button className="gold" onClick={() => {
                resetForm();
                setAdminOpen(true);
              }}>
                <Plus size={18} /> Upload Material
              </button>
            )}
          </div>

          <div className="filters">
            <div className="search">
              <Search size={18} />
              <input value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search notes, subject or topic..." />
            </div>

            <div className="tabs">
              {['all', 'lecture', 'notes', 'dpp', 'pyq', 'other'].map(k => (
                <button key={k}
                  className={kind === k ? 'selected' : ''}
                  onClick={() => setKind(k)}>
                  {k.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          <div className="classGrid">
            {['all', '9', '10', '11', '12'].map(n => (
              <button key={n}
                className={cls === n ? 'classTile active' : 'classTile'}
                onClick={() => setCls(n)}>
                {n === 'all' ? 'All Classes' : `Class ${n}`}
              </button>
            ))}
          </div>

          {message && (
            <div className="notice">
              {message}
              <button onClick={() => setMessage('')}>×</button>
            </div>
          )}

          {filtered.length === 0 ? (
            <div className="empty">
              <BookOpen size={32} />
              <h3>No resources found</h3>
              <p>New lectures, notes, DPPs and PYQs will appear here.</p>
            </div>
          ) : (
            <div className="resourceGrid">
              {filtered.map(m => (
                <article className="resource" key={m.id}>
                  <div className="resourceIcon">
                    {m.material_type === 'lecture'
                      ? <Video />
                      : m.material_type === 'notes'
                      ? <BookOpen />
                      : <FileText />}
                  </div>

                  <div className="resourceMeta">
                    <span>CLASS {m.class_level} · {m.subject}</span>
                    <span className="tag">{m.material_type.toUpperCase()}</span>
                  </div>

                  <h3>{m.title}</h3>
                  <p>{m.description || 'Study material from Master Mind Institute.'}</p>

                  <div className="resourceFoot">
                    {m.file_url && (
                      <a href={m.file_url} target="_blank" rel="noreferrer">
                        <ExternalLink size={15} /> Open
                      </a>
                    )}

                    {m.storage_path && (
                      <a href={m.file_url || '#'} target="_blank" rel="noreferrer">
                        <Download size={15} /> PDF
                      </a>
                    )}

                    {isAdmin && (
                      <div className="adminActions">
                        <button onClick={() => editMaterial(m)}>
                          <Pencil size={15} />
                        </button>
                        <button onClick={() => deleteMaterial(m)}>
                          <Trash2 size={15} />
                        </button>
                      </div>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </main>
      )}

      {/* Live Classes: पुराने Coming Soon सेक्शन को हटा दिया गया है */}
      {page === 'live' && (
        <main className="main pageMain">
          <LiveClasses />
        </main>
      )}

      {page === 'profile' && (
        <main className="main pageMain">
          <div className="profileCard">
            <div className="profileAvatar"><User size={36} /></div>
            <h2>{profile?.full_name || 'Student Profile'}</h2>
            <p>{session?.user?.email || 'Please login to view your profile.'}</p>
            <span className="tag">
              {isAdmin ? 'ADMIN ACCOUNT' : 'STUDENT ACCOUNT'}
            </span>

            {!session && (
              <button className="gold" onClick={() => setAuthOpen(true)}>
                Login / Sign up
              </button>
            )}

            {session && (
              <button className="outline" onClick={signOut}>
                <LogOut size={16} /> Logout
              </button>
            )}
          </div>
        </main>
      )}

      {isAdmin && (
        <div className="adminBar">
          <ShieldCheck size={17} />
          Admin access active
          <button onClick={() => setPage('courses')}>Manage Courses</button>
          <button onClick={() => setPage('study')}>Manage Materials</button>
        </div>
      )}

      <footer className="footer">
        <h3>MASTER MIND INSTITUTE</h3>
        <p>Dream Big... Achieve More...</p>
        <small>© {new Date().getFullYear()} Master Mind Institute. All rights reserved.</small>
      </footer>

      <nav className="bottomNav">
        <button className={page === 'home' ? 'active' : ''}
          onClick={() => setPage('home')}>
          <Home size={20} /><span>{labels.home}</span>
        </button>
        <button className={page === 'courses' ? 'active' : ''}
          onClick={() => setPage('courses')}>
          <Layers size={20} /><span>{labels.courses}</span>
        </button>
        <button className={page === 'study' ? 'active' : ''}
          onClick={() => setPage('study')}>
          <BookOpen size={20} /><span>{labels.study}</span>
        </button>
        <button className={page === 'live' ? 'active' : ''}
          onClick={() => setPage('live')}>
          <Video size={20} /><span>{labels.live}</span>
        </button>
        <button className={page === 'profile' ? 'active' : ''}
          onClick={() => setPage('profile')}>
          <User size={20} /><span>{labels.profile}</span>
        </button>
      </nav>

      {authOpen && (
        <div className="modalBackdrop" onClick={() => setAuthOpen(false)}>
          <section className="modal" onClick={e => e.stopPropagation()}>
            <button className="close" onClick={() => setAuthOpen(false)}>
              <X />
            </button>
            <h2>{signup ? 'Create Account' : 'Welcome Back'}</h2>
            <p>Master Mind Institute student account</p>

            <form onSubmit={authSubmit}>
              {signup && (
                <label>
                  Full Name
                  <input name="name" required placeholder="Your name" />
                </label>
              )}
              <label>
                Email Address
                <input name="email" type="email" required placeholder="you@example.com" />
              </label>
              <label>
                Password
                <input name="password" type="password" minLength={6}
                  required placeholder="At least 6 characters" />
              </label>
              <button className="gold full" disabled={busy}>
                {busy ? 'Please wait...' : signup ? 'Create Account' : 'Sign In'}
              </button>
            </form>

            <button className="switch" onClick={() => setSignup(!signup)}>
              {signup
                ? 'Already have an account? Sign in'
                : 'New student? Create an account'}
            </button>
          </section>
        </div>
      )}

      {adminOpen && (
        <div className="modalBackdrop" onClick={() => setAdminOpen(false)}>
          <section className="modal wide" onClick={e => e.stopPropagation()}>
            <button className="close" onClick={() => setAdminOpen(false)}>
              <X />
            </button>
            <h2>{editing ? 'Edit Study Material' : 'Upload Study Material'}</h2>

            <form onSubmit={saveMaterial} className="uploadForm">
              <label>
                Title
                <input required value={form.title}
                  onChange={e => setForm({ ...form, title: e.target.value })} />
              </label>

              <label>
                Description
                <textarea value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })} />
              </label>

              <div className="formRow">
                <label>
                  Class
                  <select value={form.class_level}
                    onChange={e => setForm({ ...form, class_level: e.target.value })}>
                    {['9', '10', '11', '12'].map(n => (
                      <option value={n} key={n}>Class {n}</option>
                    ))}
                  </select>
                </label>

                <label>
                  Subject
                  <input required value={form.subject}
                    onChange={e => setForm({ ...form, subject: e.target.value })} />
                </label>
              </div>

              <label>
                Material Type
                <select value={form.material_type}
                  onChange={e => setForm({
                    ...form,
                    material_type: e.target.value as Material['material_type']
                  })}>
                  <option value="lecture">Video Lecture</option>
                  <option value="notes">Notes</option>
                  <option value="dpp">DPP</option>
                  <option value="pyq">PYQ</option>
                  <option value="other">Other</option>
                </select>
              </label>

              <label>
                Video / Resource URL
                <input type="url" value={form.file_url}
                  onChange={e => setForm({ ...form, file_url: e.target.value })}
                  placeholder="https://..." />
              </label>

              <label className="filePick">
                <Upload size={18} /> Choose PDF / File
                <input type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,.mp4"
                  onChange={e => setFile(e.target.files?.[0] || null)} />
                {file && <small>{file.name}</small>}
              </label>

              <div className="formActions">
                <button type="button" className="outline" onClick={() => {
                  setAdminOpen(false);
                  resetForm();
                }}>
                  Cancel
                </button>
                <button className="gold" disabled={busy}>
                  {busy ? 'Uploading...' : 'Save Material'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {message && page !== 'study' && (
        <div className="floatingNotice" onClick={() => setMessage('')}>
          {message} ×
        </div>
      )}
    </div>
  );
}
