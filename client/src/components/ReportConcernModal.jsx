import React, { useState, useEffect, useRef } from 'react';
import { welfareService } from '../services/welfareService';

export default function ReportConcernModal({
  isOpen,
  onClose,
  reportedUserId,
  reportedUserName,
  contextType,
  contextId,
  onSuccess
}) {
  const isPreSelected = Boolean(reportedUserId);

  // Selected account state
  const [selectedUser, setSelectedUser] = useState(
    reportedUserId
      ? { id: reportedUserId, name: reportedUserName || `User ID: ${reportedUserId}` }
      : null
  );

  // Search & autocomplete state
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const dropdownRef = useRef(null);
  const searchInputRef = useRef(null);

  // Optional manual account description / notes (when reporter wants to note identity details)
  const [accountNotes, setAccountNotes] = useState('');
  const [showNotesField, setShowNotesField] = useState(false);

  // Complaint form state
  const [category, setCategory] = useState('peer_help_misrepresentation');
  const [description, setDescription] = useState('');
  const [originalWorkDetails, setOriginalWorkDetails] = useState('');
  const [originalWorkDate, setOriginalWorkDate] = useState('');
  const [evidenceName, setEvidenceName] = useState('');
  const [evidenceDesc, setEvidenceDesc] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Sync state when modal opens or props change
  useEffect(() => {
    if (isOpen) {
      if (reportedUserId) {
        setSelectedUser({
          id: reportedUserId,
          name: reportedUserName || `User ID: ${reportedUserId}`
        });
      } else {
        setSelectedUser(null);
      }
      setSearchTerm('');
      setSearchResults([]);
      setSearchLoading(false);
      setSearchError('');
      setDropdownOpen(false);
      setHighlightedIndex(-1);
      setAccountNotes('');
      setShowNotesField(false);
      setError('');
      setSuccessMsg('');
      setLoading(false);
    }
  }, [isOpen, reportedUserId, reportedUserName]);

  // Click-outside listener for the search dropdown
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Debounced search with race condition / stale response prevention
  useEffect(() => {
    let active = true;

    if (!isOpen || isPreSelected || selectedUser) {
      return;
    }

    const trimmed = searchTerm.trim();
    if (!trimmed) {
      setSearchResults([]);
      setDropdownOpen(false);
      setSearchLoading(false);
      return;
    }

    setSearchLoading(true);
    setSearchError('');

    const handler = setTimeout(async () => {
      try {
        const res = await welfareService.searchUsers(trimmed);
        if (!active) return; // Discard stale response if query has changed

        if (res && res.success && Array.isArray(res.users)) {
          setSearchResults(res.users);
          setDropdownOpen(true);
          setHighlightedIndex(-1);
        } else {
          setSearchResults([]);
          setDropdownOpen(true);
        }
      } catch (err) {
        if (!active) return;
        console.error('Failed to search accounts:', err);
        const msg = err.response?.data?.message || err.message || 'Unable to search accounts. Please check your connection and try again.';
        setSearchError(msg);
        setDropdownOpen(true);
      } finally {
        if (active) {
          setSearchLoading(false);
        }
      }
    }, 250);

    return () => {
      active = false;
      clearTimeout(handler);
    };
  }, [searchTerm, isOpen, isPreSelected, selectedUser]);

  if (!isOpen) return null;

  // Keyboard navigation for dropdown
  const handleKeyDown = (e) => {
    if (!dropdownOpen) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        prev < searchResults.length - 1 ? prev + 1 : 0
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        prev > 0 ? prev - 1 : searchResults.length - 1
      );
    } else if (e.key === 'Enter') {
      if (highlightedIndex >= 0 && searchResults[highlightedIndex]) {
        e.preventDefault();
        handleSelectAccount(searchResults[highlightedIndex]);
      }
    } else if (e.key === 'Escape') {
      setDropdownOpen(false);
    }
  };

  const handleSelectAccount = (user) => {
    setSelectedUser(user);
    setSearchTerm('');
    setDropdownOpen(false);
    setHighlightedIndex(-1);
    setError('');
  };

  const handleClearAccount = () => {
    setSelectedUser(null);
    setSearchTerm('');
    setSearchResults([]);
    setDropdownOpen(false);
    setHighlightedIndex(-1);
    setTimeout(() => {
      if (searchInputRef.current) {
        searchInputRef.current.focus();
      }
    }, 50);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    const targetUserId = selectedUser?.id || (reportedUserId ? parseInt(reportedUserId, 10) : null);

    if (!targetUserId) {
      setError('Please search and select the account of the person you are reporting.');
      return;
    }

    if (!description.trim() || description.trim().length < 10) {
      setError('Please provide a detailed description (at least 10 characters).');
      return;
    }

    if (category === 'academic_integrity_faculty' && !originalWorkDetails.trim()) {
      setError('Please describe your original work and provide repository/submission details.');
      return;
    }

    let finalDescription = description.trim();
    if (accountNotes.trim()) {
      finalDescription += `\n\n[Reported Account Identifier Notes]: ${accountNotes.trim()}`;
    }

    setLoading(true);
    try {
      const res = await welfareService.submitComplaint({
        reported_user_id: targetUserId,
        category,
        context_type: contextType || 'user',
        context_id: contextId || null,
        description: finalDescription,
        original_work_details: originalWorkDetails.trim() || null,
        original_work_date: originalWorkDate || null
      });

      const complaintId = res.complaint?.id;

      // If user provided evidence name, attach it
      if (complaintId && evidenceName.trim()) {
        await welfareService.uploadEvidence(complaintId, {
          file_name: evidenceName.trim(),
          file_path: `/uploads/evidence/${evidenceName.trim()}`,
          file_size: 1024,
          mime_type: 'application/pdf',
          description: evidenceDesc.trim() || 'Attached supporting evidence'
        });
      }

      setSuccessMsg(`Concern submitted successfully (Ref: ${res.complaint?.complaint_ref}). Student Welfare has been notified.`);
      setTimeout(() => {
        if (onSuccess) onSuccess(res.complaint);
        onClose();
      }, 2000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to submit concern. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose} style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center',
      justifyContent: 'center', zIndex: 9999, padding: '16px'
    }}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{
        background: '#fff', borderRadius: '8px', maxWidth: '600px', width: '100%',
        maxHeight: '90vh', overflowY: 'auto', padding: '24px', boxShadow: '0 4px 20px rgba(0,0,0,0.15)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 style={{ margin: 0, fontSize: '1.25rem', color: '#1f2937' }}>
            🛡️ Report a Concern to Student Welfare
          </h2>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#6b7280' }}
          >
            &times;
          </button>
        </div>

        {/* Policy Notice Box */}
        <div style={{
          backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0',
          borderRadius: '6px', padding: '12px', marginBottom: '16px', fontSize: '0.875rem', color: '#166534'
        }}>
          <strong>Fair Process Policy:</strong>
          <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
            <li>Good-faith reporting is fully protected and treated confidentially.</li>
            <li>An <em>unsubstantiated</em> concern merely means insufficient evidence exists and is <strong>never</strong> penalized.</li>
            <li>Knowingly false or fabricated reports are subject to our progressive warning policy.</li>
          </ul>
        </div>

        {error && (
          <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', padding: '10px', borderRadius: '6px', marginBottom: '12px' }}>
            {error}
          </div>
        )}

        {successMsg && (
          <div style={{ backgroundColor: '#ecfdf5', border: '1px solid #a7f3d0', color: '#065f46', padding: '10px', borderRadius: '6px', marginBottom: '12px' }}>
            {successMsg}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Reporting Account Selection Section */}
          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontWeight: 600, marginBottom: '6px', fontSize: '0.875rem', color: '#374151' }}>
              Reporting Account *
            </label>

            {/* Case 1: An account is selected (either pre-locked from prop or selected via search) */}
            {selectedUser ? (
              <div style={{
                border: '1px solid #bfdbfe',
                backgroundColor: '#eff6ff',
                borderRadius: '6px',
                padding: '10px 14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                  <div style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    backgroundColor: '#1e3a8a',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: '0.9rem',
                    flexShrink: 0
                  }}>
                    {selectedUser.name ? selectedUser.name[0]?.toUpperCase() : '?'}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 600, color: '#1e293b', fontSize: '0.95rem' }}>
                        {selectedUser.name}
                      </span>
                      {selectedUser.role && (
                        <span style={{
                          fontSize: '0.7rem',
                          textTransform: 'uppercase',
                          fontWeight: 700,
                          padding: '1px 6px',
                          borderRadius: '4px',
                          backgroundColor: selectedUser.role === 'faculty' ? '#fef3c7' : '#dbeafe',
                          color: selectedUser.role === 'faculty' ? '#92400e' : '#1e40af'
                        }}>
                          {selectedUser.role}
                        </span>
                      )}
                    </div>
                    {selectedUser.email && (
                      <div style={{ fontSize: '0.8rem', color: '#475569', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {selectedUser.email}
                      </div>
                    )}
                    {(selectedUser.student_id_num || selectedUser.department || selectedUser.programme) && (
                      <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>
                        {selectedUser.student_id_num ? `${selectedUser.student_id_num} • ` : ''}
                        {selectedUser.programme || selectedUser.department || ''}
                        {selectedUser.section ? ` (${selectedUser.section})` : ''}
                      </div>
                    )}
                  </div>
                </div>

                {!isPreSelected ? (
                  <button
                    type="button"
                    onClick={handleClearAccount}
                    style={{
                      background: '#fff',
                      border: '1px solid #cbd5e1',
                      borderRadius: '4px',
                      padding: '4px 10px',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      color: '#475569',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      flexShrink: 0
                    }}
                    title="Change selected account"
                  >
                    ✕ Change
                  </button>
                ) : (
                  <span style={{ fontSize: '0.75rem', color: '#64748b', fontStyle: 'italic', flexShrink: 0 }}>
                    🔒 Context Target
                  </span>
                )}
              </div>
            ) : (
              /* Case 2: No account selected yet - Interactive Search & Autocomplete */
              <div ref={dropdownRef} style={{ position: 'relative' }}>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <span style={{ position: 'absolute', left: '10px', color: '#9ca3af', fontSize: '0.9rem', pointerEvents: 'none' }}>
                    🔍
                  </span>
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onFocus={() => {
                      if (searchResults.length > 0 || (searchTerm.trim() && !searchLoading)) {
                        setDropdownOpen(true);
                      }
                    }}
                    onKeyDown={handleKeyDown}
                    placeholder="Search by student/faculty name, email, or student ID..."
                    style={{
                      width: '100%',
                      padding: '9px 36px 9px 32px',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: '0.875rem',
                      boxSizing: 'border-box'
                    }}
                    autoComplete="off"
                  />
                  {searchLoading && (
                    <span style={{
                      position: 'absolute', right: '12px',
                      width: '14px', height: '14px',
                      border: '2px solid #cbd5e1', borderTopColor: '#2563eb',
                      borderRadius: '50%',
                      animation: 'spin 0.6s linear infinite',
                      display: 'inline-block'
                    }} />
                  )}
                  {!searchLoading && searchTerm && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchTerm('');
                        setSearchResults([]);
                        setDropdownOpen(false);
                      }}
                      style={{
                        position: 'absolute', right: '10px',
                        background: 'none', border: 'none', color: '#9ca3af',
                        cursor: 'pointer', fontSize: '0.85rem'
                      }}
                      title="Clear search"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* Autocomplete Dropdown */}
                {dropdownOpen && (
                  <div style={{
                    position: 'absolute',
                    top: 'calc(100% + 4px)',
                    left: 0,
                    right: 0,
                    background: '#fff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '6px',
                    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
                    maxHeight: '260px',
                    overflowY: 'auto',
                    zIndex: 100
                  }}>
                    {searchError ? (
                      <div style={{ padding: '12px', fontSize: '0.85rem', color: '#b91c1c', textAlign: 'center' }}>
                        {searchError}
                      </div>
                    ) : searchResults.length > 0 ? (
                      searchResults.map((u, idx) => {
                        const isHighlighted = idx === highlightedIndex;
                        return (
                          <div
                            key={u.id}
                            onMouseEnter={() => setHighlightedIndex(idx)}
                            onClick={() => handleSelectAccount(u)}
                            style={{
                              padding: '10px 14px',
                              cursor: 'pointer',
                              borderBottom: idx === searchResults.length - 1 ? 'none' : '1px solid #f1f5f9',
                              backgroundColor: isHighlighted ? '#f0f9ff' : '#fff',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: '10px',
                              transition: 'background-color 0.15s ease'
                            }}
                          >
                            <div style={{ minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ fontWeight: 600, color: '#1e293b', fontSize: '0.9rem' }}>
                                  {u.name}
                                </span>
                                <span style={{
                                  fontSize: '0.65rem',
                                  textTransform: 'uppercase',
                                  fontWeight: 700,
                                  padding: '1px 5px',
                                  borderRadius: '3px',
                                  backgroundColor: u.role === 'faculty' ? '#fef3c7' : '#dbeafe',
                                  color: u.role === 'faculty' ? '#92400e' : '#1e40af'
                                }}>
                                  {u.role}
                                </span>
                              </div>
                              <div style={{ fontSize: '0.8rem', color: '#475569', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {u.email}
                              </div>
                              {(u.student_id_num || u.department || u.programme) && (
                                <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>
                                  {u.student_id_num ? `${u.student_id_num} • ` : ''}
                                  {u.programme || u.department || ''}
                                  {u.section ? ` (${u.section})` : ''}
                                </div>
                              )}
                            </div>
                            <button
                              type="button"
                              style={{
                                background: '#f8fafc',
                                border: '1px solid #cbd5e1',
                                borderRadius: '4px',
                                padding: '4px 8px',
                                fontSize: '0.75rem',
                                color: '#2563eb',
                                fontWeight: 600,
                                cursor: 'pointer',
                                flexShrink: 0
                              }}
                            >
                              Select
                            </button>
                          </div>
                        );
                      })
                    ) : (
                      !searchLoading && searchTerm.trim() && (
                        <div style={{ padding: '16px', textAlign: 'center', color: '#64748b' }}>
                          <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                            No accounts found
                          </div>
                          <div style={{ fontSize: '0.8rem' }}>
                            No matching student or faculty accounts found for &ldquo;<strong>{searchTerm}</strong>&rdquo;.
                          </div>
                          <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '6px' }}>
                            Ensure the name, email, or student ID is spelled correctly. Note that you cannot report your own account.
                          </div>
                        </div>
                      )
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Optional helper toggle for providing identity/account notes */}
            <div style={{ marginTop: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                {isPreSelected
                  ? 'Target account pre-selected from context.'
                  : selectedUser
                  ? 'Account verified. You can click "Change" to pick another account.'
                  : 'Start typing a name, email address, or student ID to select.'}
              </span>
              <button
                type="button"
                onClick={() => setShowNotesField(!showNotesField)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#2563eb',
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                  textDecoration: 'underline',
                  padding: 0
                }}
              >
                {showNotesField ? 'Hide identity notes' : '+ Add account notes / description'}
              </button>
            </div>

            {/* Collapsible Identity Description / Account Notes */}
            {showNotesField && (
              <div style={{ marginTop: '8px', padding: '10px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                  Account / Identity Description (Optional)
                </label>
                <textarea
                  rows={2}
                  value={accountNotes}
                  onChange={(e) => setAccountNotes(e.target.value)}
                  placeholder="e.g. In case of ambiguous names, specify class section, lab batch, or aliases..."
                  style={{ width: '100%', padding: '6px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '0.8rem', boxSizing: 'border-box' }}
                />
              </div>
            )}
          </div>

          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', fontWeight: 600, marginBottom: '4px', fontSize: '0.875rem' }}>
              Category of Concern *
            </label>
            <select
              value={category}
              onChange={e => setCategory(e.target.value)}
              style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '4px' }}
            >
              <option value="peer_help_misrepresentation">Peer Help: Misleading Explanations / Fabricated Skills</option>
              <option value="credit_fraud">Credit Manipulation / Artificial Exchange</option>
              <option value="academic_integrity_faculty">Academic Integrity: Suspected Misuse of Student Work (Faculty)</option>
              <option value="academic_integrity_student">Academic Integrity: Plagiarism / Uncredited Work (Student)</option>
              <option value="harassment_conduct">Harassment / Inappropriate Conduct</option>
              <option value="task_dispute">Task Dispute / Arbitrary Decision</option>
              <option value="other">Other Welfare Concern</option>
            </select>
          </div>

          {/* Dedicated section for Academic Integrity by Faculty */}
          {category === 'academic_integrity_faculty' && (
            <div style={{
              background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '6px',
              padding: '12px', marginBottom: '12px'
            }}>
              <h4 style={{ margin: '0 0 8px 0', fontSize: '0.9rem', color: '#334155' }}>
                Academic Integrity & Original Work Details
              </h4>
              <div style={{ marginBottom: '8px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '2px' }}>
                  Description of Original Work (Repo, Commit SHAs, Versions, or Document) *
                </label>
                <textarea
                  rows={2}
                  value={originalWorkDetails}
                  onChange={e => setOriginalWorkDetails(e.target.value)}
                  placeholder="Provide repository URL, commit hash, date completed, or submission proof..."
                  style={{ width: '100%', padding: '6px', border: '1px solid #d1d5db', borderRadius: '4px' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '2px' }}>
                  Date Original Work Created / Submitted
                </label>
                <input
                  type="date"
                  value={originalWorkDate}
                  onChange={e => setOriginalWorkDate(e.target.value)}
                  style={{ width: '100%', padding: '6px', border: '1px solid #d1d5db', borderRadius: '4px' }}
                />
              </div>
            </div>
          )}

          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', fontWeight: 600, marginBottom: '4px', fontSize: '0.875rem' }}>
              Detailed Description of the Concern *
            </label>
            <textarea
              rows={4}
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Explain clearly what occurred, including dates, specific communications, or observed discrepancies..."
              style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '4px' }}
              required
            />
          </div>

          {/* Evidence Attachment Fields */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontWeight: 600, marginBottom: '4px', fontSize: '0.875rem' }}>
              Supporting Evidence (Screenshots, PDFs, or Diff Logs)
            </label>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '6px' }}>
              <input
                type="text"
                placeholder="File name (e.g., chat_proof.png, similarity_diff.pdf)"
                value={evidenceName}
                onChange={e => setEvidenceName(e.target.value)}
                style={{ flex: 1, padding: '8px', border: '1px solid #d1d5db', borderRadius: '4px' }}
              />
            </div>
            <input
              type="text"
              placeholder="Brief description of this evidence"
              value={evidenceDesc}
              onChange={e => setEvidenceDesc(e.target.value)}
              style={{ width: '100%', padding: '6px', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '0.85rem' }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              style={{ padding: '8px 16px', background: '#e5e7eb', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              style={{
                padding: '8px 16px', background: '#dc2626', color: '#fff',
                border: 'none', borderRadius: '4px', fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.7 : 1
              }}
            >
              {loading ? 'Submitting…' : 'Submit Concern'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
