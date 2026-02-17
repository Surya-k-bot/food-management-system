import React, { FormEvent, useEffect, useMemo, useState } from 'react';
import './App.css';

type FoodItem = {
  id: number;
  name: string;
  category: string;
  quantity: number;
  created_at: string;
};

type FeedbackItem = {
  id: number;
  student_name: string;
  message: string;
  created_at: string;
};

type UserRole = 'student' | 'admin';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL ?? '';
const NORMALIZED_BASE_URL = API_BASE_URL.replace(/\/+$/, '').replace(/\/api$/, '');
const FOOD_URL = `${NORMALIZED_BASE_URL}/api/food-items/`;
const LOGIN_URL = `${NORMALIZED_BASE_URL}/api/auth/login/`;
const FEEDBACK_URL = `${NORMALIZED_BASE_URL}/api/feedback/`;

const FOOD_IMAGE_MAP: Array<{ keywords: string[]; image: string }> = [
  { keywords: ['rice'], image: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f35a.png' },
  { keywords: ['dal', 'sambar', 'curry'], image: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f35b.png' },
  { keywords: ['idli', 'dosa', 'chapati', 'roti', 'bread'], image: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f35e.png' },
  { keywords: ['milk'], image: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f95b.png' },
  { keywords: ['apple'], image: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f34e.png' },
  { keywords: ['banana'], image: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f34c.png' },
  { keywords: ['egg'], image: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f95a.png' },
  { keywords: ['chicken'], image: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f357.png' },
];

const DEFAULT_FOOD_IMAGE = 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f372.png';

const readJsonSafely = async (response: Response): Promise<any | null> => {
  const text = await response.text();
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

const getFoodImage = (foodName: string): string => {
  const normalized = foodName.trim().toLowerCase();
  const match = FOOD_IMAGE_MAP.find((item) =>
    item.keywords.some((keyword) => normalized.includes(keyword))
  );
  return match?.image ?? DEFAULT_FOOD_IMAGE;
};

function App() {
  const [items, setItems] = useState<FoodItem[]>([]);
  const [feedbacks, setFeedbacks] = useState<FeedbackItem[]>([]);

  const [name, setName] = useState('');
  const [category, setCategory] = useState('morning');
  const [quantity, setQuantity] = useState('1');
  const [feedbackMessage, setFeedbackMessage] = useState('');

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [feedbackStatus, setFeedbackStatus] = useState('');
  const [lastUpdated, setLastUpdated] = useState<string>('');

  const [role, setRole] = useState<UserRole | null>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [currentUser, setCurrentUser] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  const loadItems = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(FOOD_URL);
      const data = await readJsonSafely(response);
      if (!response.ok) {
        throw new Error(data?.error ?? 'Unable to load food items.');
      }
      if (!data) {
        throw new Error('Backend returned an invalid response.');
      }
      setItems(data.items ?? []);
      setLastUpdated(new Date().toLocaleTimeString());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unexpected error.');
    } finally {
      setLoading(false);
    }
  };

  const loadFeedbacks = async () => {
    try {
      const response = await fetch(FEEDBACK_URL, { credentials: 'include' });
      const data = await readJsonSafely(response);
      if (!response.ok) {
        throw new Error(data?.error ?? 'Unable to load feedback.');
      }
      setFeedbacks(data?.feedbacks ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load feedback list.');
    }
  };

  useEffect(() => {
    loadItems();
  }, []);

  useEffect(() => {
    if (role === 'admin') {
      loadFeedbacks();
    }
  }, [role]);

  const handleLogin = async (event: FormEvent) => {
    event.preventDefault();
    setLoginError('');
    setLoginLoading(true);

    try {
      const response = await fetch(LOGIN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          username: username.trim(),
          password,
        }),
      });
      const data = await readJsonSafely(response);

      if (!response.ok) {
        const fallback = response.status === 404
          ? 'Login endpoint not found. Restart backend and verify latest code is running.'
          : `Login failed (HTTP ${response.status}).`;
        throw new Error(data?.error ?? fallback);
      }

      if (!data || (data.role !== 'student' && data.role !== 'admin')) {
        throw new Error('Invalid login response from backend.');
      }

      setRole(data.role as UserRole);
      setCurrentUser(data.username ?? username.trim());
      setPassword('');
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : 'Unexpected login error.');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = () => {
    setRole(null);
    setCurrentUser('');
    setLoginError('');
    setFeedbackStatus('');
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      const response = await fetch(FOOD_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          category,
          quantity: Number(quantity),
        }),
      });

      const data = await readJsonSafely(response);

      if (!response.ok) {
        throw new Error(data?.error ?? 'Unable to create item.');
      }
      if (!data) {
        throw new Error('Backend returned an invalid response.');
      }

      setItems((previous) => [data as FoodItem, ...previous]);
      setLastUpdated(new Date().toLocaleTimeString());
      setName('');
      setCategory('morning');
      setQuantity('1');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unexpected error.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleFeedbackSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setFeedbackStatus('');
    setFeedbackSubmitting(true);

    try {
      const response = await fetch(FEEDBACK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          message: feedbackMessage,
        }),
      });

      const data = await readJsonSafely(response);
      if (!response.ok) {
        throw new Error(data?.error ?? 'Unable to submit feedback.');
      }

      setFeedbackStatus('Feedback submitted successfully.');
      setFeedbackMessage('');
    } catch (err) {
      setFeedbackStatus(err instanceof Error ? err.message : 'Unable to submit feedback.');
    } finally {
      setFeedbackSubmitting(false);
    }
  };

  const totalQuantity = useMemo(
    () => items.reduce((sum, item) => sum + item.quantity, 0),
    [items]
  );

  const todayDate = new Date().toLocaleDateString();

  const todayMenus = useMemo(() => {
    const morning = items.filter((item) => item.category.toLowerCase() === 'morning');
    const lunch = items.filter((item) => item.category.toLowerCase() === 'lunch');
    const dinner = items.filter((item) => item.category.toLowerCase() === 'dinner');
    return { morning, lunch, dinner };
  }, [items]);

  const sortedHistory = useMemo(
    () => [...items].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    [items]
  );

  const renderMenuTable = (title: string, menuItems: FoodItem[]) => (
    <section className="menu-card">
      <h3>{title} Food Item List</h3>
      {menuItems.length === 0 ? (
        <p className="empty">No items added for {title.toLowerCase()}.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Food Item</th>
              <th>Quantity</th>
            </tr>
          </thead>
          <tbody>
            {menuItems.map((item) => (
              <tr key={item.id}>
                <td>
                  <div className="food-cell">
                    <img
                      className="food-thumb"
                      src={getFoodImage(item.name)}
                      alt={item.name}
                      loading="lazy"
                    />
                    <span>{item.name}</span>
                  </div>
                </td>
                <td>{item.quantity}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );

  if (!role) {
    return (
      <main className="app-shell">
        <section className="panel login-panel">
          <p className="eyebrow">Campus Canteen</p>
          <h1>Food Management System</h1>
          <p className="subtitle">Secure student/admin login</p>
          <form className="login-form" onSubmit={handleLogin}>
            <label htmlFor="username">Username</label>
            <input
              id="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="student or admin"
              required
            />
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter password"
              required
            />
            <button type="submit" disabled={loginLoading}>
              {loginLoading ? 'Logging in...' : 'Login'}
            </button>
          </form>
          {loginError && <p className="error">{loginError}</p>}
        </section>
      </main>
    );
  }

  if (role === 'student') {
    return (
      <main className="app-shell">
        <section className="panel">
          <header className="panel-header">
            <div>
              <p className="eyebrow">Student Portal</p>
              <h1>Today Food Menus</h1>
              <p className="subtitle">Welcome, {currentUser}. Date: {todayDate}</p>
            </div>
            <div className="header-actions">
              <button className="refresh-button" onClick={loadItems} disabled={loading}>
                {loading ? 'Refreshing...' : 'Refresh'}
              </button>
              <button className="ghost-button" onClick={handleLogout}>
                Logout
              </button>
            </div>
          </header>

          {error && <p className="error">{error}</p>}

          <section className="menu-grid">
            {renderMenuTable('Morning', todayMenus.morning)}
            {renderMenuTable('Lunch', todayMenus.lunch)}
            {renderMenuTable('Dinner', todayMenus.dinner)}
          </section>

          <section className="feedback-card">
            <h3>Share Feedback</h3>
            <p className="subtitle">Your feedback is visible only on the admin page.</p>
            <form className="feedback-form" onSubmit={handleFeedbackSubmit}>
              <textarea
                value={feedbackMessage}
                onChange={(event) => setFeedbackMessage(event.target.value)}
                placeholder="Share your suggestions about today's food menu..."
                minLength={3}
                required
              />
              <button type="submit" disabled={feedbackSubmitting}>
                {feedbackSubmitting ? 'Submitting...' : 'Submit Feedback'}
              </button>
            </form>
            {feedbackStatus && <p className="status-text">{feedbackStatus}</p>}
          </section>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <section className="panel">
        <header className="panel-header">
          <div>
            <p className="eyebrow">Admin Portal</p>
            <h1>History of Food Items</h1>
            <p className="subtitle">Manage menu entries and monitor student feedback.</p>
          </div>
          <div className="header-actions">
            <button className="refresh-button" onClick={() => { loadItems(); loadFeedbacks(); }} disabled={loading || submitting}>
              {loading ? 'Refreshing...' : 'Refresh'}
            </button>
            <button className="ghost-button" onClick={handleLogout}>
              Logout
            </button>
          </div>
        </header>

        <section className="stats-grid">
          <article className="stat-card">
            <p>Total Food Records</p>
            <strong>{items.length}</strong>
          </article>
          <article className="stat-card">
            <p>Total Quantity</p>
            <strong>{totalQuantity}</strong>
          </article>
          <article className="stat-card">
            <p>Total Feedbacks</p>
            <strong>{feedbacks.length}</strong>
          </article>
        </section>

        <form className="item-form" onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="name">Food Name</label>
            <input
              id="name"
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Rice, Idli, Dal"
            />
          </div>
          <div className="field">
            <label htmlFor="category">Meal Session</label>
            <select
              id="category"
              value={category}
              onChange={(event) => setCategory(event.target.value)}
            >
              <option value="morning">Morning</option>
              <option value="lunch">Lunch</option>
              <option value="dinner">Dinner</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="quantity">Quantity</label>
            <input
              id="quantity"
              required
              type="number"
              min={1}
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
            />
          </div>
          <button className="add-button" type="submit" disabled={submitting}>
            {submitting ? 'Saving...' : 'Add Food Item'}
          </button>
        </form>

        {error && <p className="error">{error}</p>}

        <section className="history-table">
          <h3>Food Item History</h3>
          <table>
            <thead>
              <tr>
                <th>Food Item</th>
                <th>Session</th>
                <th>Quantity</th>
                <th>Created At</th>
              </tr>
            </thead>
            <tbody>
              {sortedHistory.map((item) => (
                <tr key={item.id}>
                  <td>
                    <div className="food-cell">
                      <img
                        className="food-thumb"
                        src={getFoodImage(item.name)}
                        alt={item.name}
                        loading="lazy"
                      />
                      <span>{item.name}</span>
                    </div>
                  </td>
                  <td>{item.category}</td>
                  <td>{item.quantity}</td>
                  <td>{new Date(item.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!loading && sortedHistory.length === 0 && <p className="empty">No history found.</p>}
        </section>

        <section className="history-table">
          <h3>Submitted Feedbacks</h3>
          <table>
            <thead>
              <tr>
                <th>Student</th>
                <th>Feedback</th>
                <th>Submitted At</th>
              </tr>
            </thead>
            <tbody>
              {feedbacks.map((item) => (
                <tr key={item.id}>
                  <td>{item.student_name}</td>
                  <td>{item.message}</td>
                  <td>{new Date(item.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {feedbacks.length === 0 && <p className="empty">No feedback submitted yet.</p>}
          <p className="updated">Updated: {lastUpdated || 'Not yet'}</p>
        </section>
      </section>
    </main>
  );
}

export default App;
