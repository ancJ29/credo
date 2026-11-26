import {
  clientAddress,
  clientCodeSchema,
  passwordIsValid,
  type SignUpRequest,
} from '@credo/shared';
import { Button, PasswordInput, Stack, TextInput } from '@mantine/core';
import { IconLock, IconPhone, IconUser } from '@tabler/icons-react';
import { type SubmitEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { type Api, ApiError } from '../api';
import { DoorHeading } from '../components/atoms/DoorHeading';
import { FormMessage } from '../components/molecules/FormMessage';
import { DoorCard } from '../components/organisms/DoorCard';
import { DoorPage } from '../components/organisms/DoorPage';
import { CREDO_BRAND } from '../brand';
import { BRAND_GRADIENT } from '../design-system/appTheme';

/** What a failed try says: the address taken, a field the rule refuses, the queue full, or the
 * service unavailable. */
type Problem = 'taken' | 'codeInvalid' | 'nameInvalid' | 'passwordInvalid' | 'full' | 'unavailable';

/** Stands for the address while the sent sentence is split around it; no dictionary line holds it. */
const ADDRESS_MARK = '\u0001';

const PROBLEM_WORDS = {
  taken: 'signUp.taken',
  codeInvalid: 'operator.codeInvalid',
  nameInvalid: 'operator.nameInvalid',
  passwordInvalid: 'person.passwordInvalid',
  full: 'signUp.full',
  unavailable: 'common.unavailable',
} as const satisfies Record<Problem, string>;

/**
 * A company asks for its address and root: its name, the address it wants, who to call and the
 * phone, and the root's password, on credo's own card. Nothing is sent that its own rules refuse.
 * The answer is a card that says it was sent and what happens next; the company opens only once an
 * operator approves it.
 */
export function SignUpPage({ api }: { api: Api }) {
  const { t } = useTranslation();
  const [typed, setTyped] = useState({
    name: '',
    code: '',
    contactName: '',
    contactPhone: '',
    password: '',
  });
  const [problem, setProblem] = useState<Problem | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<{ name: string; code: string } | null>(null);
  const set = (field: keyof typeof typed) => (event: { currentTarget: { value: string } }) => {
    const { value } = event.currentTarget;
    setTyped((was) => ({ ...was, [field]: value }));
  };

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    const request: SignUpRequest = {
      code: typed.code.trim().toLowerCase(),
      name: typed.name.trim(),
      contactName: typed.contactName.trim(),
      contactPhone: typed.contactPhone.trim(),
      password: typed.password,
    };
    if (!clientCodeSchema.safeParse(request.code).success) return setProblem('codeInvalid');
    if (request.name === '') return setProblem('nameInvalid');
    if (!passwordIsValid(request.password)) return setProblem('passwordInvalid');
    setProblem(null);
    setBusy(true);
    try {
      const result = await api.signUp(request);
      if (result.kind === 'taken') setProblem('taken');
      else setSent({ name: request.name, code: result.code });
    } catch (error) {
      setProblem(error instanceof ApiError && error.status === 503 ? 'full' : 'unavailable');
    }
    setBusy(false);
  }

  // The sentence is said once with a mark where the address goes, so the address sits in its own element
  // (the walk masks it: the stack's port is free on every run) and the words stay the dictionary's.
  const [before = '', after = ''] = t('signUp.sentText', {
    name: sent?.name,
    address: ADDRESS_MARK,
  }).split(ADDRESS_MARK);
  const sentWords = { before, after };

  const onCode = problem === 'taken' || problem === 'codeInvalid';
  return (
    <DoorPage>
      <DoorCard name={CREDO_BRAND.name}>
        {sent ? (
          <Stack gap="md">
            <DoorHeading title={t('signUp.sentTitle')} />
            <FormMessage kind="success">
              {sentWords.before}
              <span data-sent-address>{clientAddress(window.location.origin, sent.code)}</span>
              {sentWords.after}
            </FormMessage>
          </Stack>
        ) : (
          <form onSubmit={(event) => void submit(event)}>
            <Stack gap="md">
              <DoorHeading title={t('signUp.title')} subtitle={t('signUp.intro')} />
              {(problem === 'full' || problem === 'unavailable') && (
                <FormMessage kind="error">{t(PROBLEM_WORDS[problem])}</FormMessage>
              )}
              <TextInput
                label={t('signUp.name')}
                value={typed.name}
                onChange={set('name')}
                error={problem === 'nameInvalid' ? t(PROBLEM_WORDS.nameInvalid) : undefined}
                required
              />
              <TextInput
                label={t('signUp.code')}
                description={t('signUp.codeHint')}
                autoCapitalize="none"
                autoComplete="off"
                value={typed.code}
                onChange={set('code')}
                error={onCode && problem ? t(PROBLEM_WORDS[problem]) : undefined}
                required
              />
              <TextInput
                label={t('signUp.contactName')}
                leftSection={<IconUser size={18} />}
                value={typed.contactName}
                onChange={set('contactName')}
                required
              />
              <TextInput
                label={t('signUp.contactPhone')}
                type="tel"
                leftSection={<IconPhone size={18} />}
                value={typed.contactPhone}
                onChange={set('contactPhone')}
                required
              />
              <PasswordInput
                label={t('signUp.password')}
                description={t('person.passwordHint')}
                leftSection={<IconLock size={18} />}
                autoComplete="new-password"
                value={typed.password}
                onChange={set('password')}
                error={problem === 'passwordInvalid' ? t(PROBLEM_WORDS.passwordInvalid) : undefined}
                required
              />
              <Button
                type="submit"
                fullWidth
                size="md"
                loading={busy}
                style={{ background: BRAND_GRADIENT, color: 'var(--credo-on-header)' }}
              >
                {t('signUp.submit')}
              </Button>
            </Stack>
          </form>
        )}
      </DoorCard>
    </DoorPage>
  );
}
