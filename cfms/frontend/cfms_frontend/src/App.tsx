import React, { FormEvent, useEffect, useMemo, useState } from 'react';
import './App.css';

type FoodItem = {
  id: number;
  name: string;
  category: string;
  quantity: number;
  image_url: string;
  created_at: string;
};

type FeedbackItem = {
  id: number;
  student_name: string;
  food_item_id: number | null;
  food_item_name: string;
  rating: number;
  message: string;
  created_at: string;
};

type AnalyticsItem = {
  food_name: string;
  avg_rating: number;
  count: number;
};

type AnalyticsData = {
  top_rated: AnalyticsItem[];
  rating_distribution: Record<string, number>;
};

type UserRole = 'student' | 'admin';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL ?? '';
const NORMALIZED_BASE_URL = API_BASE_URL.replace(/\/+$/, '').replace(/\/api$/, '');
const FOOD_URL = `${NORMALIZED_BASE_URL}/api/food-items/`;
const LOGIN_URL = `${NORMALIZED_BASE_URL}/api/auth/login/`;
const FEEDBACK_URL = `${NORMALIZED_BASE_URL}/api/feedback/`;
const ANALYTICS_URL = `${NORMALIZED_BASE_URL}/api/analytics/feedback/`;
const FOOD_CSV_URL = `${NORMALIZED_BASE_URL}/api/reports/food-items.csv`;
const FOOD_PDF_URL = `${NORMALIZED_BASE_URL}/api/reports/food-items.pdf`;
const FEEDBACK_CSV_URL = `${NORMALIZED_BASE_URL}/api/reports/feedback.csv`;
const FEEDBACK_PDF_URL = `${NORMALIZED_BASE_URL}/api/reports/feedback.pdf`;

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
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

const getFoodImage = (item: Pick<FoodItem, 'name' | 'image_url'>): string => {
  if (item.image_url) return item.image_url;
  const normalized = item.name.trim().toLowerCase();
  const match = FOOD_IMAGE_MAP.find((entry) =>
    entry.keywords.some((keyword) => normalized.includes(keyword))
  );
  return match?.image ?? DEFAULT_FOOD_IMAGE;
};

const queryString = (params: Record<string, string>) => {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value.trim()) search.set(key, value.trim());
  });
  const query = search.toString();
  return query ? `?${query}` : '';
};

function App() {
  const [items, setItems] = useState<FoodItem[]>([]);
  const [feedbacks, setFeedbacks] = useState<FeedbackItem[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsData>({ top_rated: [], rating_distribution: {} });

  const [name, setName] = useState('');
  const [category, setCategory] = useState('morning');
  const [quantity, setQuantity] = useState('1');
  const [imageFile, setImageFile] = useState<File | null>(null);

  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [feedbackRating, setFeedbackRating] = useState('5');
  const [feedbackFoodId, setFeedbackFoodId] = useState('');

  const [filterSearch, setFilterSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');

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

  const filters = useMemo(
    () => ({ search: filterSearch, category: filterCategory, date_from: filterFrom, date_to: filterTo }),
    [filterSearch, filterCategory, filterFrom, filterTo]
  );

  const loadItems = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`${FOOD_URL}${queryString(filters)}`, { credentials: 'include' });
      const data = await readJsonSafely(response);
      if (!response.ok) throw new Error(data?.error ?? 'Unable to load food items.');
      if (!data) throw new Error('Backend returned an invalid response.');
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
      const response = await fetch(`${FEEDBACK_URL}${queryString(filters)}`, { credentials: 'include' });
      const data = await readJsonSafely(response);
      if (!response.ok) throw new Error(data?.error ?? 'Unable to load feedback.');
      setFeedbacks(data?.feedbacks ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load feedback list.');
    }
  };

  const loadAnalytics = async () => {
    try {
      const response = await fetch(`${ANALYTICS_URL}${queryString(filters)}`, { credentials: 'include' });
      const data = await readJsonSafely(response);
      if (!response.ok) throw new Error(data?.error ?? 'Unable to load analytics.');
      if (!data) throw new Error('Invalid analytics response.');
      setAnalytics({
        top_rated: data.top_rated ?? [],
        rating_distribution: data.rating_distribution ?? {},
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load analytics.');
    }
  };

  useEffect(() => {
    loadItems();
  }, [filterSearch, filterCategory, filterFrom, filterTo]);

  useEffect(() => {
    if (role === 'admin') {
      loadFeedbacks();
      loadAnalytics();
    }
  }, [role, filterSearch, filterCategory, filterFrom, filterTo]);

  const handleLogin = async (event: FormEvent) => {
    event.preventDefault();
    setLoginError('');
    setLoginLoading(true);
    try {
      const response = await fetch(LOGIN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username: username.trim(), password }),
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
      const payload = new FormData();
      payload.append('name', name);
      payload.append('category', category);
      payload.append('quantity', quantity);
      if (imageFile) payload.append('image', imageFile);

      const response = await fetch(FOOD_URL, {
        method: 'POST',
        credentials: 'include',
        body: payload,
      });

      const data = await readJsonSafely(response);
      if (!response.ok) throw new Error(data?.error ?? 'Unable to create item.');
      if (!data) throw new Error('Backend returned an invalid response.');

      setItems((previous) => [data as FoodItem, ...previous]);
      setLastUpdated(new Date().toLocaleTimeString());
      setName('');
      setCategory('morning');
      setQuantity('1');
      setImageFile(null);
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
          rating: Number(feedbackRating),
          food_item_id: feedbackFoodId ? Number(feedbackFoodId) : null,
        }),
      });
      const data = await readJsonSafely(response);
      if (!response.ok) throw new Error(data?.error ?? 'Unable to submit feedback.');
      setFeedbackStatus('Feedback submitted successfully.');
      setFeedbackMessage('');
      setFeedbackFoodId('');
      setFeedbackRating('5');
    } catch (err) {
      setFeedbackStatus(err instanceof Error ? err.message : 'Unable to submit feedback.');
    } finally {
      setFeedbackSubmitting(false);
    }
  };

  const totalQuantity = useMemo(() => items.reduce((sum, item) => sum + item.quantity, 0), [items]);

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
                    <img className="food-thumb" src={getFoodImage(item)} alt={item.name} loading="lazy" />
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

  const exportUrlWithFilters = (base: string) => `${base}${queryString(filters)}`;

  if (!role) {
    return (
      <main className="app-shell">
        <section className="panel login-panel">
          <p className="eyebrow">Campus Canteen</p>
          <h1>Food Management System</h1>
          <p className="subtitle">Secure student/admin login</p>
          <form className="login-form" onSubmit={handleLogin}>
            <label htmlFor="username">Username</label>
            <input id="username" value={username} onChange={(e) => setUsername(e.target.value)} required />
            <label htmlFor="password">Password</label>
            <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            <button type="submit" disabled={loginLoading}>{loginLoading ? 'Logging in...' : 'Login'}</button>
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
              <button className="refresh-button" onClick={loadItems} disabled={loading}>{loading ? 'Refreshing...' : 'Refresh'}</button>
              <button className="ghost-button" onClick={handleLogout}>Logout</button>
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
            <p className="subtitle">Your feedback with rating is visible only on the admin page.</p>
            <form className="feedback-form" onSubmit={handleFeedbackSubmit}>
              <label htmlFor="feedbackFood">Food Item (optional)</label>
              <select id="feedbackFood" value={feedbackFoodId} onChange={(e) => setFeedbackFoodId(e.target.value)}>
                <option value="">Select food item</option>
                {items.map((item) => (
                  <option key={item.id} value={item.id}>{item.name} ({item.category})</option>
                ))}
              </select>

              <label htmlFor="feedbackRating">Rating</label>
              <select id="feedbackRating" value={feedbackRating} onChange={(e) => setFeedbackRating(e.target.value)}>
                <option value="5">5 - Excellent</option>
                <option value="4">4 - Good</option>
                <option value="3">3 - Average</option>
                <option value="2">2 - Poor</option>
                <option value="1">1 - Very Poor</option>
              </select>

              <label htmlFor="feedbackMessage">Comment</label>
              <textarea
                id="feedbackMessage"
                value={feedbackMessage}
                onChange={(e) => setFeedbackMessage(e.target.value)}
                placeholder="Share your suggestions about today's food menu..."
                minLength={3}
                required
              />
              <button type="submit" disabled={feedbackSubmitting}>{feedbackSubmitting ? 'Submitting...' : 'Submit Feedback'}</button>
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
            <p className="subtitle">Manage menu, ratings, exports, and notification-aware operations.</p>
          </div>
          <div className="header-actions">
            <button className="refresh-button" onClick={() => { loadItems(); loadFeedbacks(); loadAnalytics(); }} disabled={loading || submitting}>
              {loading ? 'Refreshing...' : 'Refresh'}
            </button>
            <button className="ghost-button" onClick={handleLogout}>Logout</button>
          </div>
        </header>

        <section className="stats-grid">
          <article className="stat-card"><p>Total Food Records</p><strong>{items.length}</strong></article>
          <article className="stat-card"><p>Total Quantity</p><strong>{totalQuantity}</strong></article>
          <article className="stat-card"><p>Total Feedbacks</p><strong>{feedbacks.length}</strong></article>
        </section>

        <section className="filters-grid">
          <input value={filterSearch} onChange={(e) => setFilterSearch(e.target.value)} placeholder="Search food/student/message" />
          <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
            <option value="">All sessions</option>
            <option value="morning">Morning</option>
            <option value="lunch">Lunch</option>
            <option value="dinner">Dinner</option>
          </select>
          <input type="date" value={filterFrom} onChange={(e) => setFilterFrom(e.target.value)} />
          <input type="date" value={filterTo} onChange={(e) => setFilterTo(e.target.value)} />
        </section>

        <section className="export-row">
          <a href={exportUrlWithFilters(FOOD_CSV_URL)} target="_blank" rel="noreferrer">Export Food CSV</a>
          <a href={exportUrlWithFilters(FOOD_PDF_URL)} target="_blank" rel="noreferrer">Export Food PDF</a>
          <a href={exportUrlWithFilters(FEEDBACK_CSV_URL)} target="_blank" rel="noreferrer">Export Feedback CSV</a>
          <a href={exportUrlWithFilters(FEEDBACK_PDF_URL)} target="_blank" rel="noreferrer">Export Feedback PDF</a>
        </section>

        <form className="item-form" onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="name">Food Name</label>
            <input id="name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Rice, Idli, Dal" />
          </div>
          <div className="field">
            <label htmlFor="category">Meal Session</label>
            <select id="category" value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="morning">Morning</option>
              <option value="lunch">Lunch</option>
              <option value="dinner">Dinner</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="quantity">Quantity</label>
            <input id="quantity" required type="number" min={1} value={quantity} onChange={(e) => setQuantity(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="image">Food Image</label>
            <input id="image" type="file" accept="image/*" onChange={(e) => setImageFile(e.target.files?.[0] ?? null)} />
          </div>
          <button className="add-button" type="submit" disabled={submitting}>{submitting ? 'Saving...' : 'Add Food Item'}</button>
        </form>

        {error && <p className="error">{error}</p>}

        <section className="history-table">
          <h3>Rating Dashboard</h3>
          <div className="charts-grid">
            <div className="chart-card">
              <h4>Top Rated Meals</h4>
              {analytics.top_rated.length === 0 ? <p className="empty">No ratings yet.</p> : analytics.top_rated.map((item) => (
                <div className="bar-line" key={item.food_name}>
                  <span>{item.food_name}</span>
                  <div className="bar-wrap"><div className="bar-fill" style={{ width: `${(item.avg_rating / 5) * 100}%` }} /></div>
                  <strong>{item.avg_rating.toFixed(1)} ({item.count})</strong>
                </div>
              ))}
            </div>
            <div className="chart-card">
              <h4>Rating Distribution</h4>
              {['5', '4', '3', '2', '1'].map((key) => {
                const value = analytics.rating_distribution[key] ?? 0;
                const total = Object.values(analytics.rating_distribution).reduce((sum, n) => sum + n, 0);
                const width = total > 0 ? (value / total) * 100 : 0;
                return (
                  <div className="bar-line" key={key}>
                    <span>{key} Star</span>
                    <div className="bar-wrap"><div className="bar-fill secondary" style={{ width: `${width}%` }} /></div>
                    <strong>{value}</strong>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section className="history-table">
          <h3>Food Item History</h3>
          <table>
            <thead>
              <tr><th>Food Item</th><th>Session</th><th>Quantity</th><th>Created At</th></tr>
            </thead>
            <tbody>
              {sortedHistory.map((item) => (
                <tr key={item.id}>
                  <td>
                    <div className="food-cell">
                      <img className="food-thumb" src={getFoodImage(item)} alt={item.name} loading="lazy" />
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
              <tr><th>Student</th><th>Food Item</th><th>Rating</th><th>Feedback</th><th>Submitted At</th></tr>
            </thead>
            <tbody>
              {feedbacks.map((item) => (
                <tr key={item.id}>
                  <td>{item.student_name}</td>
                  <td>{item.food_item_name || '-'}</td>
                  <td>{item.rating}</td>
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
