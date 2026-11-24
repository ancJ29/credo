import {
  BackLink,
  Button,
  Checkbox,
  Divider,
  DoorCard,
  DoorHeading,
  IconKeyboard,
  IconLock,
  IconQrcode,
  IconUser,
  PasswordInput,
  Stack,
  TextInput,
} from 'credo-design-system';

export const SignIn = () => (
  <DoorCard name="An Phat">
    <Stack gap="md">
      <DoorHeading title="Sign in" />
      <TextInput label="Username" placeholder="Your username" leftSection={<IconUser size={18} />} />
      <PasswordInput label="Password" placeholder="Your password" leftSection={<IconLock size={18} />} />
      <Checkbox defaultChecked label="Remember me" />
      <Button variant="gradient" size="md" fullWidth>
        Sign in
      </Button>
      <Divider label="or" />
      <Button variant="default" fullWidth leftSection={<IconQrcode size={18} />}>
        Use a sign-in link
      </Button>
    </Stack>
  </DoorCard>
);

export const SignInLink = () => (
  <DoorCard name="An Phat">
    <Stack gap="md" align="center">
      <DoorHeading title="Sign in with a link" subtitle="Scan the code your manager gave you" />
      <Button variant="gradient" size="md" fullWidth leftSection={<IconQrcode size={18} />}>
        Scan the QR code
      </Button>
      <Divider label="or" w="100%" />
      <Button variant="default" fullWidth leftSection={<IconKeyboard size={18} />}>
        Enter the code
      </Button>
      <BackLink href="#">Back to sign in</BackLink>
    </Stack>
  </DoorCard>
);
