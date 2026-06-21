import '@testing-library/jest-dom/vitest';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import GuidePage from './+page.svelte';

describe('Guide Page', () => {
  it('renders the How To Use heading', () => {
    render(GuidePage);
    expect(screen.getByRole('heading', { name: /how to use/i })).toBeInTheDocument();
  });

  it('renders the main guide sections', () => {
    render(GuidePage);
    expect(screen.getByRole('heading', { name: /getting started/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /conversion modes/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /what to expect/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /toast notifications/i })).toBeInTheDocument();
  });

  it('contains a back link to the dashboard', () => {
    render(GuidePage);
    const backLink = screen.getByRole('link', { name: '←' });
    expect(backLink).toBeInTheDocument();
    expect(backLink.getAttribute('href')).toBe('/');
  });
});
