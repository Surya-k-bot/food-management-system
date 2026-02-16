import React, { FormEvent, useEffect, useMemo, useState } from 'react';
import './App.css';

type FoodItem = {
  id: number;
  name: string;
  category: string;
  quantity: number;
  created_at: string;
};

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL ?? '';
const API_URL = `${API_BASE_URL}/api/food-items/`;

function App() {
  const [items, setItems] = useState<FoodItem[]>([]);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState<string>('');

  const loadItems = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(API_URL);
      if (!response.ok) {
        throw new Error('Unable to load food items.');
      }
      const data = await response.json();
      setItems(data.items ?? []);
      setLastUpdated(new Date().toLocaleTimeString());
    } catch (err) {
      if (err instanceof TypeError) {
        setError('Cannot reach backend API. Start Django server on http://localhost:8000.');
      } else {
        setError(err instanceof Error ? err.message : 'Unexpected error.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadItems();
  }, []);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          category,
          quantity: Number(quantity),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? 'Unable to create item.');
      }

      setItems((previous) => [data as FoodItem, ...previous]);
      setLastUpdated(new Date().toLocaleTimeString());
      setName('');
      setCategory('');
      setQuantity('1');
    } catch (err) {
      if (err instanceof TypeError) {
        setError('Cannot reach backend API. Start Django server on http://localhost:8000.');
      } else {
        setError(err instanceof Error ? err.message : 'Unexpected error.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const categories = useMemo(() => {
    const unique = new Set(items.map((item) => item.category));
    return ['All', ...Array.from(unique).sort((a, b) => a.localeCompare(b))];
  }, [items]);

  const filteredItems = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return items.filter((item) => {
      const matchesCategory = activeCategory === 'All' || item.category === activeCategory;
      const matchesSearch =
        query.length === 0 ||
        item.name.toLowerCase().includes(query) ||
        item.category.toLowerCase().includes(query);
      return matchesCategory && matchesSearch;
    });
  }, [items, activeCategory, searchTerm]);

  const totalQuantity = useMemo(
    () => items.reduce((sum, item) => sum + item.quantity, 0),
    [items]
  );

  const lowStockCount = useMemo(
    () => items.filter((item) => item.quantity <= 2).length,
    [items]
  );

  return (
    <main className="app-shell">
      <div className="background-orb orb-1" />
      <div className="background-orb orb-2" />

      <section className="panel">
        <header className="panel-header">
          <div>
            <p className="eyebrow">Kitchen Inventory</p>
            <h1>Food Management System</h1>
            <p className="subtitle">Organize stock, watch shortages, and keep supplies in check.</p>
          </div>
          <button className="refresh-button" onClick={loadItems} disabled={loading || submitting}>
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </header>

        <section className="stats-grid">
          <article className="stat-card">
            <p>Total Items</p>
            <strong>{items.length}</strong>
          </article>
          <article className="stat-card">
            <p>Total Quantity</p>
            <strong>{totalQuantity}</strong>
          </article>
          <article className="stat-card">
            <p>Categories</p>
            <strong>{categories.length - 1}</strong>
          </article>
          <article className="stat-card warning">
            <p>Low Stock</p>
            <strong>{lowStockCount}</strong>
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
              placeholder="Rice, Apple, Milk"
            />
          </div>
          <div className="field">
            <label htmlFor="category">Category</label>
            <input
              id="category"
              required
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              placeholder="Grains, Fruits, Dairy"
            />
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
            {submitting ? 'Saving...' : 'Add Item'}
          </button>
        </form>

        <section className="toolbar">
          <input
            className="search-input"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search by name or category"
          />
          <select
            className="category-select"
            value={activeCategory}
            onChange={(event) => setActiveCategory(event.target.value)}
          >
            {categories.map((itemCategory) => (
              <option key={itemCategory} value={itemCategory}>
                {itemCategory}
              </option>
            ))}
          </select>
          <p className="updated">Updated: {lastUpdated || 'Not yet'}</p>
        </section>

        {error && <p className="error">{error}</p>}

        {loading ? (
          <p className="placeholder">Loading items...</p>
        ) : filteredItems.length === 0 ? (
          <p className="placeholder">No items match this filter.</p>
        ) : (
          <ul className="item-list">
            {filteredItems.map((item) => (
              <li key={item.id} className="item-card">
                <div>
                  <strong>{item.name}</strong>
                  <p>{item.category}</p>
                </div>
                <div className="qty-cell">
                  <span>Qty: {item.quantity}</span>
                  {item.quantity <= 2 && <em>Low stock</em>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

export default App;
