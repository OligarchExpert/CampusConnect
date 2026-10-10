import React, { useState } from 'react';
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
  const [category, setCategory] = useState('peer_help_misrepresentation');
  const [description, setDescription] = useState('');
  const [originalWorkDetails, setOriginalWorkDetails] = useState('');
  const [originalWorkDate, setOriginalWorkDate] = useState('');
  const [evidenceName, setEvidenceName] = useState('');
  const [evidenceDesc, setEvidenceDesc] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (!description.trim() || description.trim().length < 10) {
      setError('Please provide a detailed description (at least 10 characters).');
      return;
    }

    if (category === 'academic_integrity_faculty' && !originalWorkDetails.trim()) {
      setError('Please describe your original work and provide repository/submission details.');
      return;
    }

    setLoading(true);
    try {
      const res = await welfareService.submitComplaint({
        reported_user_id: reportedUserId,
        category,
        context_type: contextType || 'user',
        context_id: contextId || null,
        description: description.trim(),
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
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#6b7280' }}>
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
          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', fontWeight: 600, marginBottom: '4px', fontSize: '0.875rem' }}>
              Reporting Account
            </label>
            <input
              type="text"
              readOnly
              value={reportedUserName || `User ID: ${reportedUserId}`}
              style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '4px', background: '#f3f4f6' }}
            />
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
                border: 'none', borderRadius: '4px', fontWeight: 600, cursor: 'pointer'
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
