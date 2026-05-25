export interface SequenceStep {
  num: number
  key: string
  name: string
  delay: string
  subject: string
  preview: string
  body: string
}

export const STEPS: SequenceStep[] = [
  {
    num: 1,
    key: 'invite_1',
    name: 'Initial Invite',
    delay: 'Day 0',
    subject: "You're invited — [Event Name]",
    preview: "Hi {{first_name}}, I wanted to personally reach out about an exclusive boardroom event we're hosting for senior technology and business leaders...",
    body: `Hi {{first_name}},

I wanted to personally reach out about an exclusive boardroom event we're hosting for senior technology and business leaders.

This is a curated, invitation-only gathering where senior executives exchange unfiltered perspectives on the challenges shaping the next 12–24 months.

The event details:
📅 [Event Date]
📍 [Event Location]
👥 ~20 senior leaders (C-suite, VP, Director level)

There's no vendor pitch — just a structured peer conversation.

Would you be open to joining us?

Best,
[Your Name]`,
  },
  {
    num: 2,
    key: 'followup_1',
    name: 'Follow-up 1',
    delay: '+3 days',
    subject: 'Following up — [Event Name]',
    preview: "Hi {{first_name}}, just following up on my note from earlier this week. I know your calendar is busy, but I think this event would be genuinely valuable for you...",
    body: `Hi {{first_name}},

Just following up on my note from earlier this week. I know your calendar is busy, but I think this event would be genuinely valuable for you.

We've confirmed a strong cohort of senior leaders from your sector — the kind of room where conversations tend to be candid and surprisingly useful.

If you'd like to know who else is attending before you decide, happy to share a few names.

Let me know either way.

Best,
[Your Name]`,
  },
  {
    num: 3,
    key: 'followup_2',
    name: 'Follow-up 2',
    delay: '+4 days',
    subject: 'One more thought — [Event Name]',
    preview: "Hi {{first_name}}, I won't keep filling your inbox — but I did want to share one more detail about this event that I think changes the picture...",
    body: `Hi {{first_name}},

I won't keep filling your inbox — but I did want to share one more detail about this event that I think changes the picture.

We've structured it so the first 30 minutes are a completely open floor — no facilitator, no set agenda. Leaders just talking through what's actually on their minds right now.

In our experience, that's where the most useful conversations happen.

If you've been on the fence, that might be worth knowing.

[Your Name]`,
  },
  {
    num: 4,
    key: 'followup_3',
    name: 'Follow-up 3',
    delay: '+3 days',
    subject: 'Quick question — [Event Name]',
    preview: `Hi {{first_name}}, quick question — is this kind of event something that would be on your radar at all? Even a "not right now" helps me...`,
    body: `Hi {{first_name}},

Quick question — is this kind of event something that would be on your radar at all? Even a "not right now" is helpful so I know whether to keep a spot open for you.

No pressure.

[Your Name]`,
  },
  {
    num: 5,
    key: 'final',
    name: 'Final',
    delay: '+7 days',
    subject: 'Last one from me — [Event Name]',
    preview: "Hi {{first_name}}, this is my last note on this. If the timing isn't right, I completely understand — I'll leave a spot open just in case...",
    body: `Hi {{first_name}},

This is my last note on this. If the timing isn't right, I completely understand — I'll leave a spot open just in case things change.

If you'd like to join us, just reply and I'll get you confirmed straight away.

Best of luck with everything at {{company}}.

[Your Name]`,
  },
]

export const STEP_ORDER = ['invite_1', 'followup_1', 'followup_2', 'followup_3', 'final'] as const
export type StepKey = typeof STEP_ORDER[number]

export const STEP_DEPTH: Record<string, number> = {
  invite_1: 0,
  followup_1: 1,
  followup_2: 2,
  followup_3: 3,
  final: 4,
}
