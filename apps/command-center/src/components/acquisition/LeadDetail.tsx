/**
 * LeadDetail Component
 *
 * Displays detailed information about an acquisition lead.
 */

import { useState } from 'react';
import {
  useLead,
  useChangeStage,
  useLogInteraction,
  useSetFollowUp,
  usePassOnLead,
} from '../../hooks/useAcquisition';
import {
  PIPELINE_STAGES,
  PIPELINE_STAGE_LABELS,
  PIPELINE_STAGE_COLORS,
  type PipelineStage,
  type InteractionType,
  type InteractionOutcome,
} from '../../types/acquisition';
import Card from '../common/Card';
import Button from '../common/Button';
import LoadingSpinner from '../common/LoadingSpinner';
import ScoreBreakdown from './ScoreBreakdown';

interface LeadDetailProps {
  leadId: string;
  onClose: () => void;
}

export default function LeadDetail({ leadId, onClose }: LeadDetailProps) {
  const { data: lead, isLoading } = useLead(leadId);
  const [showInteractionForm, setShowInteractionForm] = useState(false);
  const [showPassForm, setShowPassForm] = useState(false);
  const [activeTab, setActiveTab] = useState<'info' | 'interactions' | 'notes'>('info');

  const changeStage = useChangeStage();
  const logInteraction = useLogInteraction();
  const setFollowUp = useSetFollowUp();
  const passOnLead = usePassOnLead();

  if (isLoading) {
    return (
      <Card className="flex items-center justify-center h-64">
        <LoadingSpinner />
      </Card>
    );
  }

  if (!lead) {
    return (
      <Card className="text-center py-8">
        <p className="text-text-muted">Lead not found</p>
      </Card>
    );
  }

  const handleStageChange = (stage: PipelineStage) => {
    if (stage === 'passed') {
      setShowPassForm(true);
    } else {
      changeStage.mutate({ id: leadId, data: { stage } });
    }
  };

  const handlePass = (reason: string) => {
    passOnLead.mutate({ id: leadId, reason });
    setShowPassForm(false);
  };

  const handleFollowUp = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    setFollowUp.mutate({ id: leadId, followUpDate: tomorrow.toISOString() });
  };

  return (
    <Card className="sticky top-4">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold">{lead.businessName}</h2>
          {lead.dbaName && <p className="text-sm text-text-muted">DBA: {lead.dbaName}</p>}
        </div>
        <button onClick={onClose} className="text-text-muted hover:text-white transition-colors">
          ✕
        </button>
      </div>

      {/* Score Breakdown */}
      {lead.acquisitionScore !== null && (
        <div className="mb-4 p-3 rounded-lg bg-dark-bg">
          <ScoreBreakdown
            totalScore={lead.acquisitionScore}
            factors={lead.scoreBreakdown}
            automationPotential={lead.automationPotential}
            summary={lead.scoreSummary}
            compact
          />
        </div>
      )}

      {/* Stage Selector */}
      <div className="mb-4">
        <label className="block text-sm text-text-muted mb-2">Pipeline Stage</label>
        <div className="flex flex-wrap gap-1">
          {PIPELINE_STAGES.filter((s) => s !== 'closed_won' && s !== 'closed_lost').map((stage) => (
            <button
              key={stage}
              onClick={() => handleStageChange(stage)}
              className={`px-2 py-1 rounded text-xs transition-all ${
                lead.pipelineStage === stage
                  ? PIPELINE_STAGE_COLORS[stage]
                  : 'bg-dark-bg text-text-muted hover:bg-dark-card-hover'
              }`}
            >
              {PIPELINE_STAGE_LABELS[stage]}
            </button>
          ))}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="flex gap-2 mb-4">
        <Button size="sm" variant="secondary" onClick={handleFollowUp}>
          📅 Set Follow-up
        </Button>
        <Button size="sm" variant="secondary" onClick={() => setShowInteractionForm(true)}>
          📝 Log Interaction
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-dark-border mb-4">
        {(['info', 'interactions', 'notes'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm transition-colors ${
              activeTab === tab
                ? 'border-b-2 border-accent text-accent'
                : 'text-text-muted hover:text-white'
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="max-h-96 overflow-y-auto">
        {activeTab === 'info' && (
          <div className="space-y-4">
            {/* Registry Info */}
            <InfoSection title="Registry Information">
              <InfoRow label="Entity Number" value={lead.entityNumber} />
              <InfoRow label="Entity Type" value={lead.entityType} />
              <InfoRow label="Status" value={`${lead.status} - ${lead.statusDetails}`} />
              <InfoRow
                label="Filed"
                value={lead.filingDate ? new Date(lead.filingDate).toLocaleDateString() : undefined}
              />
              <InfoRow label="Business Age" value={lead.businessAge ? `${lead.businessAge} years` : undefined} />
            </InfoSection>

            {/* Contact Info */}
            {(lead.ownerName || lead.ownerEmail || lead.ownerPhone || lead.websiteUrl) && (
              <InfoSection title="Contact Information">
                <InfoRow label="Owner" value={lead.ownerName} />
                <InfoRow label="Email" value={lead.ownerEmail} isLink />
                <InfoRow label="Phone" value={lead.ownerPhone} />
                <InfoRow label="Website" value={lead.websiteUrl} isLink />
                {lead.ownerLinkedIn && (
                  <InfoRow label="LinkedIn" value={lead.ownerLinkedIn} isLink />
                )}
              </InfoSection>
            )}

            {/* Address */}
            {lead.principalAddress && (
              <InfoSection title="Address">
                <p className="text-sm">{lead.principalAddress}</p>
              </InfoSection>
            )}

            {/* Reviews */}
            {(lead.googleRating || lead.yelpRating) && (
              <InfoSection title="Online Reviews">
                {lead.googleRating && (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-yellow-400">★</span>
                    <span>{lead.googleRating.toFixed(1)}</span>
                    <span className="text-text-muted">
                      ({lead.googleReviewCount} Google reviews)
                    </span>
                  </div>
                )}
                {lead.yelpRating && (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-red-400">★</span>
                    <span>{lead.yelpRating.toFixed(1)}</span>
                    <span className="text-text-muted">
                      ({lead.yelpReviewCount} Yelp reviews)
                    </span>
                  </div>
                )}
              </InfoSection>
            )}

            {/* CRM Stats */}
            <InfoSection title="Outreach">
              <InfoRow label="Contact Attempts" value={lead.contactAttempts.toString()} />
              <InfoRow
                label="Last Contacted"
                value={lead.lastContactedAt ? new Date(lead.lastContactedAt).toLocaleDateString() : 'Never'}
              />
              <InfoRow
                label="Next Follow-up"
                value={lead.nextFollowUpAt ? new Date(lead.nextFollowUpAt).toLocaleDateString() : 'Not set'}
              />
            </InfoSection>
          </div>
        )}

        {activeTab === 'interactions' && (
          <div className="space-y-3">
            {lead.interactions && lead.interactions.length > 0 ? (
              lead.interactions.map((interaction) => (
                <div
                  key={interaction.id}
                  className="p-3 rounded-lg bg-dark-bg text-sm"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium capitalize">{interaction.interactionType}</span>
                    <span className="text-text-muted text-xs">
                      {new Date(interaction.interactionDate).toLocaleDateString()}
                    </span>
                  </div>
                  {interaction.subject && (
                    <p className="font-medium text-text-muted">{interaction.subject}</p>
                  )}
                  {interaction.summary && <p className="text-text-muted mt-1">{interaction.summary}</p>}
                  {interaction.outcome && (
                    <span
                      className={`inline-block mt-2 px-2 py-0.5 rounded text-xs ${
                        interaction.outcome === 'positive'
                          ? 'bg-green-500/20 text-green-400'
                          : interaction.outcome === 'negative'
                            ? 'bg-red-500/20 text-red-400'
                            : 'bg-gray-500/20 text-gray-400'
                      }`}
                    >
                      {interaction.outcome}
                    </span>
                  )}
                </div>
              ))
            ) : (
              <p className="text-center text-text-muted py-4">No interactions yet</p>
            )}
          </div>
        )}

        {activeTab === 'notes' && (
          <div>
            {lead.notes ? (
              <p className="text-sm whitespace-pre-wrap">{lead.notes}</p>
            ) : (
              <p className="text-center text-text-muted py-4">No notes yet</p>
            )}
          </div>
        )}
      </div>

      {/* Interaction Form Modal */}
      {showInteractionForm && (
        <InteractionForm
          onSubmit={(data) => {
            logInteraction.mutate({ leadId, data });
            setShowInteractionForm(false);
          }}
          onClose={() => setShowInteractionForm(false)}
        />
      )}

      {/* Pass Form Modal */}
      {showPassForm && (
        <PassForm onSubmit={handlePass} onClose={() => setShowPassForm(false)} />
      )}
    </Card>
  );
}

// Helper Components
function InfoSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="text-sm font-semibold text-text-muted mb-2">{title}</h4>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function InfoRow({
  label,
  value,
  isLink,
}: {
  label: string;
  value?: string | null;
  isLink?: boolean;
}) {
  if (!value) return null;

  return (
    <div className="flex justify-between text-sm">
      <span className="text-text-muted">{label}</span>
      {isLink ? (
        <a
          href={value.startsWith('http') ? value : `mailto:${value}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent hover:underline truncate max-w-[60%]"
        >
          {value}
        </a>
      ) : (
        <span className="truncate max-w-[60%]">{value}</span>
      )}
    </div>
  );
}

// Interaction Form
function InteractionForm({
  onSubmit,
  onClose,
}: {
  onSubmit: (data: any) => void;
  onClose: () => void;
}) {
  const [type, setType] = useState<InteractionType>('call');
  const [summary, setSummary] = useState('');
  const [outcome, setOutcome] = useState<InteractionOutcome>('neutral');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      interactionType: type,
      interactionDate: new Date().toISOString(),
      summary,
      outcome,
      direction: 'outbound',
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-dark-card p-6 rounded-lg w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-bold mb-4">Log Interaction</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-text-muted mb-1">Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as InteractionType)}
              className="w-full px-3 py-2 bg-dark-bg border border-dark-border rounded-lg"
            >
              <option value="call">Call</option>
              <option value="email">Email</option>
              <option value="meeting">Meeting</option>
              <option value="site_visit">Site Visit</option>
              <option value="linkedin">LinkedIn</option>
              <option value="letter">Letter</option>
              <option value="note">Note</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-text-muted mb-1">Summary</label>
            <textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              className="w-full px-3 py-2 bg-dark-bg border border-dark-border rounded-lg h-24"
              placeholder="What happened?"
            />
          </div>
          <div>
            <label className="block text-sm text-text-muted mb-1">Outcome</label>
            <select
              value={outcome}
              onChange={(e) => setOutcome(e.target.value as InteractionOutcome)}
              className="w-full px-3 py-2 bg-dark-bg border border-dark-border rounded-lg"
            >
              <option value="positive">Positive</option>
              <option value="neutral">Neutral</option>
              <option value="negative">Negative</option>
              <option value="no_response">No Response</option>
            </select>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">Log Interaction</Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Pass Form
function PassForm({
  onSubmit,
  onClose,
}: {
  onSubmit: (reason: string) => void;
  onClose: () => void;
}) {
  const [reason, setReason] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(reason || 'No reason provided');
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-dark-card p-6 rounded-lg w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-bold mb-4">Pass on Lead</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-text-muted mb-1">Reason for passing</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-3 py-2 bg-dark-bg border border-dark-border rounded-lg h-24"
              placeholder="Why are you passing on this lead?"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">Pass</Button>
          </div>
        </form>
      </div>
    </div>
  );
}
