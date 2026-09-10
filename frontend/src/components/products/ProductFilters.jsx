import { useEffect, useRef, useState } from 'react';
import apiClient from '../../api/axios.js';
import { API_PATHS } from '../../utils/constants.js';
import './ProductFilters.css';

const DEBOUNCE_MS = 300;

/**
 * ProductFilters
 *
 * Props:
 *   filters   — { search: string, category: string, brand: string }
 *   onChange  — (partial) => void   (merges into parent state)
 */
export default function ProductFilters({ filters = {}, onChange }) {
  const { search = '', category = '', brand = '' } = filters;

  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const debounceRef = useRef(null);

  // Load filter options once
  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const [catRes, brandRes] = await Promise.all([
          apiClient.get(API_PATHS.categories.list),
          apiClient.get(API_PATHS.brands.list),
        ]);
        const catData = catRes.data?.data ?? catRes.data ?? [];
        const brandData = brandRes.data?.data ?? brandRes.data ?? [];
        setCategories(Array.isArray(catData) ? catData : []);
        setBrands(Array.isArray(brandData) ? brandData : []);
      } catch {
        // Non-critical — dropdowns just stay empty
      }
    };
    fetchOptions();
  }, []);

  const handleSearchChange = (e) => {
    const value = e.target.value;
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onChange({ search: value });
    }, DEBOUNCE_MS);
  };

  const hasActiveFilters = search || category || brand;

  return (
    <div className="pfilters">
      <div className="pfilters__search-wrap">
        <span className="pfilters__search-icon" aria-hidden="true">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="6.5" cy="6.5" r="5" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </span>
        <input
          type="search"
          className="pfilters__search"
          placeholder="Search products…"
          defaultValue={search}
          onChange={handleSearchChange}
          aria-label="Search products"
        />
      </div>

      <select
        className="pfilters__select"
        value={category}
        onChange={(e) => onChange({ category: e.target.value })}
        aria-label="Filter by category"
      >
        <option value="">All categories</option>
        {categories.map((cat) => (
          <option key={cat._id} value={cat._id}>{cat.name}</option>
        ))}
      </select>

      <select
        className="pfilters__select"
        value={brand}
        onChange={(e) => onChange({ brand: e.target.value })}
        aria-label="Filter by brand"
      >
        <option value="">All brands</option>
        {brands.map((b) => (
          <option key={b._id} value={b._id}>{b.name}</option>
        ))}
      </select>

      {hasActiveFilters && (
        <button
          type="button"
          className="pfilters__clear"
          onClick={() => onChange({ search: '', category: '', brand: '' })}
        >
          Clear
        </button>
      )}
    </div>
  );
}
