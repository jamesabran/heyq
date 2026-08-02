import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { ThemeProvider } from '../../contexts/ThemeContext';
import { IdentityProvider } from '../../contexts/IdentityContext';
import { routes } from '../../routes';
// The test API server shares this file's module registry (src/test/setup.ts), so
// the provider seam and store reached over HTTP are the same instances.
import {
  unavailableAiProvider,
  __resetAiReviewProviderForTest,
  __setAiReviewProviderForTest,
} from '../../../../server/aiReviewProvider';

function renderApp(path: string, identityId = 'team_lead') {
  window.localStorage.setItem('heyq-identity', identityId);
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  return render(
    <ThemeProvider>
      <IdentityProvider>
        <RouterProvider router={router} />
      </IdentityProvider>
    </ThemeProvider>,
  );
}

/** Answer every scored criterion Yes so a review can be submitted. */
async function answerAllYes(user: ReturnType<typeof userEvent.setup>) {
  const groups = screen.getAllByRole('radiogroup');
  for (const group of groups) {
    await user.click(within(group).getByRole('radio', { name: 'Yes' }));
  }
}

// AI reviews are switched OFF by default (HEYQ_AI_REVIEW_ENABLED); the tests
// that run one opt in explicitly, exactly as a deployment has to.
beforeEach(() => {
  process.env.HEYQ_AI_REVIEW_ENABLED = 'true';
});

afterEach(() => {
  delete process.env.HEYQ_AI_REVIEW_ENABLED;
});

describe('quality reviews — access control', () => {
  it('blocks a non-reviewer from the Quality Reviews page', async () => {
    renderApp('/app/reviews', 'l1_agent');
    expect(await screen.findByText(/access restricted/i)).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Quality Reviews' })).not.toBeInTheDocument();
  });

  it('lets a team lead in, and shows the Quality Reviews nav item', async () => {
    renderApp('/app/reviews', 'team_lead');
    expect(await screen.findByRole('heading', { name: 'Quality Reviews' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /quality reviews/i })).toBeInTheDocument();
  });

  it('blocks a non-reviewer from the review workspace', async () => {
    renderApp('/app/reviews/tkt-seed-4', 'l1_agent');
    expect(await screen.findByText(/access restricted/i)).toBeInTheDocument();
  });
});

describe('quality reviews — board', () => {
  it('shows the three columns with the seeded completed and draft reviews', async () => {
    renderApp('/app/reviews', 'team_lead');
    await screen.findByRole('heading', { name: 'Quality Reviews' });

    expect(screen.getByRole('heading', { name: /to review/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /in progress/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /completed/i })).toBeInTheDocument();

    // Completed: the seeded submitted review (tkt-bp-3 → HQ-2026-0103) with its score.
    expect(await screen.findByRole('link', { name: 'HQ-2026-0103' })).toBeInTheDocument();
    expect(screen.getByText('96%')).toBeInTheDocument();
    // In progress: the seeded draft (tkt-seed-7 → HQ-2026-0007).
    expect(screen.getByRole('link', { name: 'HQ-2026-0007' })).toBeInTheDocument();
  });

  it('filters completed reviews by score band', async () => {
    const user = userEvent.setup();
    renderApp('/app/reviews', 'team_lead');
    await screen.findByRole('link', { name: 'HQ-2026-0103' });

    // The only completed review scored 96%; a "below 70%" filter hides it.
    await user.selectOptions(screen.getByLabelText('Score'), 'lt70');
    expect(screen.queryByRole('link', { name: 'HQ-2026-0103' })).not.toBeInTheDocument();
  });
});

describe('quality reviews — entry points', () => {
  it('entry point 1: selecting a ticket on the board opens the workspace', async () => {
    const user = userEvent.setup();
    renderApp('/app/reviews', 'team_lead');
    await screen.findByRole('heading', { name: 'Quality Reviews' });

    await user.click(await screen.findByRole('link', { name: 'HQ-2026-0005' }));

    expect(await screen.findByRole('heading', { name: /quality review/i })).toBeInTheDocument();
    // Ticket + agent are pre-filled: the reviewed agent is the ticket's assignee.
    expect(screen.getByText(/reviewing alex cruz's handling of hq-2026-0005/i)).toBeInTheDocument();
  });

  it('entry point 2: an agent profile lists the agent\'s tickets to review', async () => {
    const user = userEvent.setup();
    renderApp('/app/agents/l1_agent', 'team_lead');

    expect(await screen.findByRole('heading', { name: 'Alex Cruz' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /tickets to review/i })).toBeInTheDocument();

    await user.click(await screen.findByRole('link', { name: 'HQ-2026-0008' }));
    expect(await screen.findByRole('heading', { name: /quality review/i })).toBeInTheDocument();
  });

  it('entry point 3: ticket details offers Start quality review to reviewers only', async () => {
    renderApp('/app/tickets/tkt-seed-8', 'team_lead');
    await screen.findByRole('heading', { name: /question about my invoice/i });
    expect(screen.getByRole('link', { name: /start quality review/i })).toBeInTheDocument();
  });

  it('entry point 3: hides Start quality review from a non-reviewer', async () => {
    renderApp('/app/tickets/tkt-seed-8', 'l1_agent');
    await screen.findByRole('heading', { name: /question about my invoice/i });
    expect(screen.queryByRole('link', { name: /start quality review/i })).not.toBeInTheDocument();
  });
});

describe('quality reviews — workspace & scoring', () => {
  it('renders read-only evidence and a live score, and flags a zero-tolerance No', async () => {
    const user = userEvent.setup();
    renderApp('/app/reviews/tkt-seed-5', 'team_lead');

    // Evidence: the conversation is present and read-only (no reply composer).
    expect(await screen.findByRole('heading', { name: 'Conversation' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /send reply/i })).not.toBeInTheDocument();

    // A No on the zero-tolerance "respectful tone" criterion flags the review.
    const toneGroup = screen.getByRole('radiogroup', { name: /respectful, courteous tone/i });
    await user.click(within(toneGroup).getByRole('radio', { name: 'No' }));
    expect(await screen.findByText(/zero-tolerance finding/i)).toBeInTheDocument();
  });

  it('keeps Submit disabled until required criteria are answered, then submits', async () => {
    const user = userEvent.setup();
    renderApp('/app/reviews/tkt-seed-16', 'team_lead');

    const submit = await screen.findByRole('button', { name: /submit review/i });
    expect(submit).toBeDisabled();

    await answerAllYes(user);
    expect(screen.getByText('100%')).toBeInTheDocument();
    expect(submit).toBeEnabled();

    await user.click(submit);
    expect(await screen.findByText(/review submitted/i)).toBeInTheDocument();
  });

  it('saves a draft without requiring every criterion', async () => {
    const user = userEvent.setup();
    renderApp('/app/reviews/tkt-seed-15', 'team_lead');

    await screen.findByRole('heading', { name: 'Conversation' });
    await user.click(screen.getByRole('button', { name: /save draft/i }));
    expect(await screen.findByText(/draft saved/i)).toBeInTheDocument();
  });

  it('renders a submitted review as read-only with its frozen score', async () => {
    renderApp('/app/reviews/tkt-bp-3', 'team_lead');
    // The seeded completed review shows its score and locks the form.
    expect(await screen.findByText(/final and can no longer be edited/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /submit review/i })).not.toBeInTheDocument();
    expect(screen.getByText('96%')).toBeInTheDocument();
  });
});

/**
 * tkt-bp-4 (HQ-2026-0104) carries a seeded AI review and no supervisor review.
 * These run in order: the board and profile label it, then a lead reviews it.
 */
describe('quality reviews — AI and supervisor reviews are distinguishable', () => {
  it('labels the AI-reviewed ticket on the board but keeps it in "To review"', async () => {
    renderApp('/app/reviews', 'team_lead');
    await screen.findByRole('heading', { name: 'Quality Reviews' });

    // Still queued for a supervisor, with the AI context labelled on the row.
    const row = (await screen.findByRole('link', { name: 'HQ-2026-0104' })).closest('tr')!;
    expect(within(row).getByText('AI review')).toBeInTheDocument();
    expect(within(row).getByRole('link', { name: /start review/i })).toBeInTheDocument();

    // The AI review does NOT occupy a supervisor workflow column — every review
    // listed under "Completed" is labelled as a supervisor review.
    const completed = screen.getByRole('heading', { name: /completed/i }).closest('section')!;
    expect(within(completed).queryByText('AI review')).not.toBeInTheDocument();
    expect(within(completed).getAllByText('Supervisor review').length).toBeGreaterThan(0);
  });

  it('labels both review types on the agent profile', async () => {
    renderApp('/app/agents/l1_agent', 'team_lead');
    await screen.findByRole('heading', { name: 'Alex Cruz' });

    // Scoped to the review history — HQ-2026-0104 also appears in the agent's
    // "Tickets to review" list, which is exactly the point: an AI review does not
    // take it off that list.
    const history = screen.getByRole('heading', { name: /^reviews/i }).closest('section')!;
    const aiRow = within(history).getByRole('link', { name: 'HQ-2026-0104' }).closest('tr')!;
    expect(within(aiRow).getByText('AI review')).toBeInTheDocument();
    // The agent's supervisor review is labelled as such, on its own row.
    const supervisorRow = within(history).getByRole('link', { name: 'HQ-2026-0103' }).closest('tr')!;
    expect(within(supervisorRow).getByText('Supervisor review')).toBeInTheDocument();
  });

  it('shows the AI review as read-only context without prefilling the form', async () => {
    renderApp('/app/reviews/tkt-bp-4', 'team_lead');
    await screen.findByRole('heading', { name: 'Conversation' });

    // The AI review is labelled and scored…
    expect(screen.getByText('AI review')).toBeInTheDocument();
    expect(screen.getByText(/check the findings against the conversation/i)).toBeInTheDocument();
    // …while the supervisor's own form starts empty and unsubmittable.
    expect(screen.getByRole('button', { name: /submit review/i })).toBeDisabled();
    for (const group of screen.getAllByRole('radiogroup')) {
      for (const radio of within(group).getAllByRole('radio')) {
        expect(radio).not.toBeChecked();
      }
    }
  });

  it('lets a supervisor start and submit a review on an AI-reviewed ticket', async () => {
    const user = userEvent.setup();
    renderApp('/app/reviews/tkt-bp-4', 'team_lead');

    const submit = await screen.findByRole('button', { name: /submit review/i });
    await answerAllYes(user);
    expect(submit).toBeEnabled();

    await user.click(submit);
    expect(await screen.findByText(/review submitted/i)).toBeInTheDocument();
    // The AI review is still there afterwards — neither record replaced the other.
    expect(screen.getByText('AI review')).toBeInTheDocument();
  });
});

/**
 * The Run AI review action and how its result is presented. tkt-seed-9 and
 * tkt-seed-11 have no AI review seeded, so each test starts from an empty panel.
 */
describe('quality reviews — running an AI review', () => {
  afterEach(() => __resetAiReviewProviderForTest());

  it('offers the action to a reviewer, with no AI review yet', async () => {
    renderApp('/app/reviews/tkt-seed-17', 'team_lead');
    await screen.findByRole('heading', { name: 'Conversation' });

    expect(screen.getByRole('button', { name: /run ai review/i })).toBeEnabled();
    expect(screen.getByText(/no ai review yet/i)).toBeInTheDocument();
  });

  it('shows the AI score, rationales, and an AI label after a successful run', async () => {
    const user = userEvent.setup();
    renderApp('/app/reviews/tkt-seed-17', 'team_lead');
    await screen.findByRole('heading', { name: 'Conversation' });

    await user.click(screen.getByRole('button', { name: /run ai review/i }));

    // Wait on the RESULT, not the panel's type badge — that badge labels the
    // panel itself and is present before a run has produced anything.
    await screen.findByText('AI findings');

    // Labelled as AI-generated, with a score and the model that produced it.
    expect(screen.getByText('AI review')).toBeInTheDocument();
    // Provenance is on one line, so assert over the whole element's text.
    const provenance = screen.getByText(/check the findings against the conversation/i);
    expect(provenance).toHaveTextContent('heyq-fake-reviewer');
    expect(provenance).toHaveTextContent('rubric v1');
    expect(provenance).toHaveTextContent('threshold 80%');

    // Per-criterion rationales are shown, not just a bare number. Scoped to the
    // findings list, since the criterion labels also appear in the form below.
    const findings = screen.getByText('AI findings').closest('details')!;
    expect(within(findings).getByText(/15 criteria/i)).toBeInTheDocument();
    // One rationale per criterion — an unexplained AI score is not reviewable.
    expect(within(findings).getAllByText(/the conversation shows this standard met/i).length).toBeGreaterThan(0);
    expect(within(findings).getAllByRole('listitem')).toHaveLength(15);
    // …each backed by a quoted transcript excerpt and a confidence.
    expect(within(findings).getAllByText(/^(requester|agent): "/).length).toBe(15);
    expect(within(findings).getAllByText(/% confidence$/).length).toBe(15);
    expect(provenance).toHaveTextContent(/average confidence/);
    // Re-running is offered once a review exists.
    expect(screen.getByRole('button', { name: /re-run ai review/i })).toBeInTheDocument();
  });

  it('shows a failure without breaking the workspace', async () => {
    const user = userEvent.setup();
    __setAiReviewProviderForTest(unavailableAiProvider);
    renderApp('/app/reviews/tkt-seed-10', 'team_lead');
    await screen.findByRole('heading', { name: 'Conversation' });

    await user.click(screen.getByRole('button', { name: /run ai review/i }));

    expect(await screen.findByText(/didn't complete/i)).toBeInTheDocument();
    expect(screen.getByText(/ai reviewer is unavailable/i)).toBeInTheDocument();
    // …and the supervisor can still do their own review.
    expect(screen.getByRole('button', { name: /save draft/i })).toBeEnabled();
  });

  it('states WHY a supervisor review is required when the AI fails', async () => {
    const user = userEvent.setup();
    __setAiReviewProviderForTest(unavailableAiProvider);
    renderApp('/app/reviews/tkt-bp-1', 'team_lead');
    await screen.findByRole('heading', { name: 'Conversation' });

    await user.click(screen.getByRole('button', { name: /run ai review/i }));

    expect(await screen.findByText(/supervisor review required/i)).toBeInTheDocument();
    expect(screen.getByText(/could not complete this review/i)).toBeInTheDocument();
  });

  it('leaves the supervisor form empty and independently editable', async () => {
    const user = userEvent.setup();
    renderApp('/app/reviews/tkt-bp-2', 'team_lead');
    await screen.findByRole('heading', { name: 'Conversation' });

    // Type an answer BEFORE running, to prove the run neither clears nor
    // overwrites work in progress.
    const empathy = screen.getByRole('radiogroup', { name: /genuine empathy/i });
    await user.click(within(empathy).getByRole('radio', { name: 'No' }));

    await user.click(screen.getByRole('button', { name: /run ai review/i }));
    await screen.findByText('AI findings'); // the run has actually produced a result

    // The supervisor's own answer survived, and the AI's answers were NOT copied in.
    expect(within(empathy).getByRole('radio', { name: 'No' })).toBeChecked();
    const greeting = screen.getByRole('radiogroup', { name: /on-brand greeting/i });
    for (const radio of within(greeting).getAllByRole('radio')) expect(radio).not.toBeChecked();
    // Still incomplete, so still not submittable — the AI did not submit for them.
    expect(screen.getByRole('button', { name: /submit review/i })).toBeDisabled();
  });

  it('still renders the seeded AI review beside a supervisor review', async () => {
    // An earlier test in this file submitted a supervisor review on tkt-bp-4, so
    // this is the both-types-present case: the AI record and the supervisor's own
    // assessment are shown together, each labelled, neither replacing the other.
    renderApp('/app/reviews/tkt-bp-4', 'team_lead');
    await screen.findByRole('heading', { name: 'Conversation' });

    expect(screen.getByText('AI review')).toBeInTheDocument();
    expect(screen.getByText('96%')).toBeInTheDocument(); // the seeded AI score
    // 96% is above the 80% threshold, so no supervisor review was REQUIRED —
    // and one was still performed, which is the whole point.
    expect(screen.queryByText(/supervisor review required/i)).not.toBeInTheDocument();
    expect(screen.getByText(/final and can no longer be edited/i)).toBeInTheDocument();
  });
});
