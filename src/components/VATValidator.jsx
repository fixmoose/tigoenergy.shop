/**
 * VAT Validator Component
 * Place this in your checkout or billing form
 * Validates VAT numbers in real-time using the free EC VIES API
 */

'use client';

import { useState } from 'react';

export default function VATValidator() {
  const [vatInput, setVatInput] = useState('');
  const [validation, setValidation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const validateVAT = async (vatId) => {
    if (!vatId || vatId.length < 4) {
      setValidation(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/validate-vat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ vatId: vatId.toUpperCase() }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Validation failed');
        setValidation(null);
        return;
      }

      setValidation(data);
      setError(null);
    } catch (err) {
      setError('Could not validate VAT number. Please try again.');
      setValidation(null);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const value = e.target.value;
    setVatInput(value);
    
    // Debounce validation - only validate after user stops typing
    const timer = setTimeout(() => {
      validateVAT(value);
    }, 500);

    return () => clearTimeout(timer);
  };

  return (
    <div className="vat-validator">
      <div className="form-group">
        <label htmlFor="vat-input">
          EU VAT Number
          <span className="optional"> (optional for B2B)</span>
        </label>
        <input
          id="vat-input"
          type="text"
          placeholder="e.g., DE123456789, FR12345678901"
          value={vatInput}
          onChange={handleInputChange}
          disabled={loading}
          className="form-input"
        />
        <small className="help-text">
          Enter your VAT ID (country code + number). No spaces needed.
        </small>
      </div>

      {loading && (
        <div className="status-message loading">
          ✓ Validating VAT number...
        </div>
      )}

      {error && (
        <div className="status-message error">
          ✗ {error}
        </div>
      )}

      {validation && !loading && (
        <div className={`vat-result ${validation.valid ? 'valid' : 'invalid'}`}>
          <div className="result-header">
            {validation.valid ? (
              <>
                <span className="badge success">✓ Valid VAT</span>
                <p className="company-name">{validation.name}</p>
              </>
            ) : (
              <>
                <span className="badge error">✗ Invalid VAT</span>
                <p className="error-text">This VAT number is not registered in VIES</p>
              </>
            )}
          </div>

          {validation.valid && (
            <div className="company-details">
              <div className="detail-row">
                <span className="label">VAT Number:</span>
                <span className="value">
                  {validation.countryCode}{validation.vatNumber}
                </span>
              </div>
              <div className="detail-row">
                <span className="label">Address:</span>
                <span className="value">{validation.address}</span>
              </div>
              <div className="detail-row">
                <span className="label">Request ID:</span>
                <span className="value small">{validation.requestIdentifier}</span>
              </div>
              {validation.cached && (
                <div className="detail-row">
                  <span className="label">Status:</span>
                  <span className="value">Cached (24h) - Fresh request available</span>
                </div>
              )}
            </div>
          )}

          <div className="vat-implications">
            {validation.valid ? (
              <div className="info-box">
                <strong>✓ VAT Exemption Available</strong>
                <p>
                  This is a valid EU VAT number. You can apply VAT exemption for intra-EU 
                  B2B transactions if you're supplying goods/services to another EU business.
                </p>
              </div>
            ) : (
              <div className="warning-box">
                <strong>⚠ VAT Cannot be Exempted</strong>
                <p>
                  Since this VAT number is not valid, standard VAT rates will apply to your order.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      <style jsx>{`
        .vat-validator {
          margin: 20px 0;
          font-family: system-ui, -apple-system, sans-serif;
        }

        .form-group {
          margin-bottom: 16px;
        }

        label {
          display: block;
          margin-bottom: 6px;
          font-weight: 500;
          color: #333;
        }

        .optional {
          font-weight: normal;
          color: #666;
          font-size: 0.9em;
        }

        .form-input {
          width: 100%;
          padding: 10px 12px;
          border: 2px solid #e0e0e0;
          border-radius: 6px;
          font-size: 14px;
          font-family: monospace;
          transition: border-color 0.2s;
        }

        .form-input:focus {
          outline: none;
          border-color: #4f46e5;
          box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1);
        }

        .form-input:disabled {
          background-color: #f5f5f5;
          cursor: not-allowed;
        }

        .help-text {
          display: block;
          margin-top: 6px;
          color: #666;
          font-size: 13px;
        }

        .status-message {
          padding: 10px 12px;
          border-radius: 6px;
          font-size: 14px;
          margin-top: 8px;
        }

        .status-message.loading {
          background-color: #e3f2fd;
          color: #1565c0;
          border-left: 3px solid #1565c0;
        }

        .status-message.error {
          background-color: #ffebee;
          color: #c62828;
          border-left: 3px solid #c62828;
        }

        .vat-result {
          margin-top: 16px;
          border: 2px solid #e0e0e0;
          border-radius: 8px;
          padding: 16px;
          background-color: #fafafa;
        }

        .vat-result.valid {
          border-color: #4caf50;
          background-color: #f1f8f4;
        }

        .vat-result.invalid {
          border-color: #f44336;
          background-color: #fdeae8;
        }

        .result-header {
          margin-bottom: 16px;
        }

        .badge {
          display: inline-block;
          padding: 4px 10px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 600;
          margin-bottom: 8px;
        }

        .badge.success {
          background-color: #c8e6c9;
          color: #2e7d32;
        }

        .badge.error {
          background-color: #ffcdd2;
          color: #c62828;
        }

        .company-name {
          font-size: 16px;
          font-weight: 600;
          color: #333;
          margin: 0;
        }

        .error-text {
          font-size: 14px;
          color: #c62828;
          margin: 0;
        }

        .company-details {
          background-color: white;
          padding: 12px;
          border-radius: 6px;
          margin-bottom: 12px;
        }

        .detail-row {
          display: flex;
          justify-content: space-between;
          padding: 6px 0;
          font-size: 13px;
          border-bottom: 1px solid #e0e0e0;
        }

        .detail-row:last-child {
          border-bottom: none;
        }

        .detail-row .label {
          font-weight: 500;
          color: #666;
          min-width: 100px;
        }

        .detail-row .value {
          color: #333;
          font-weight: 500;
          word-break: break-word;
          text-align: right;
        }

        .detail-row .value.small {
          font-size: 11px;
          font-family: monospace;
        }

        .info-box,
        .warning-box {
          padding: 12px;
          border-radius: 6px;
          font-size: 13px;
          line-height: 1.5;
        }

        .info-box {
          background-color: #c8e6c9;
          border-left: 4px solid #2e7d32;
          color: #1b5e20;
        }

        .warning-box {
          background-color: #ffe0b2;
          border-left: 4px solid #e65100;
          color: #bf360c;
        }

        .info-box strong,
        .warning-box strong {
          display: block;
          margin-bottom: 6px;
        }

        .info-box p,
        .warning-box p {
          margin: 0;
        }
      `}</style>
    </div>
  );
}
