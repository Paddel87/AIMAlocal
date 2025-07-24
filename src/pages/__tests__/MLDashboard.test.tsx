import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import MLDashboard from '../MLDashboard';

const renderWithRouter = (component: React.ReactElement) => {
  return render(
    <BrowserRouter>
      {component}
    </BrowserRouter>
  );
};

describe('MLDashboard', () => {
  it('renders dashboard with tabs', () => {
    renderWithRouter(<MLDashboard />);

    expect(screen.getByText('ML Dashboard')).toBeInTheDocument();
    expect(screen.getAllByText('Face Detection')).toHaveLength(2); // Tab and section
    expect(screen.getAllByText('Audio Transcription')).toHaveLength(2); // Tab and section
  });
});