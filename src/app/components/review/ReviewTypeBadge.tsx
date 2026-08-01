import { REVIEW_TYPE_LABELS, reviewTypeOf, type QualityReview } from '../../models/review';
import { Badge } from '../ui/Badge';

/**
 * Who authored a review. Authorship is read from the record's `reviewType` — never
 * inferred from the reviewer's name — so an AI review can never be mistaken for a
 * supervisor's judgement (or the reverse) anywhere it is listed.
 */
export function ReviewTypeBadge({ review }: { review: Pick<QualityReview, 'reviewType'> }) {
  const type = reviewTypeOf(review);
  return (
    <Badge variant={type === 'ai' ? 'teal' : 'outline'}>{REVIEW_TYPE_LABELS[type]}</Badge>
  );
}
