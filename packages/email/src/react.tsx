import * as React from "react";
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Link,
  Section,
  Text,
} from "@react-email/components";
import type {
  EmailBrand,
  AuthEmailKind,
  AuthEmailCopy,
  AuthEmailTemplateProps,
} from "./types";

export const defaultAuthCopy = {
  confirmation: {
    subject: "Verify your email",
    heading: "One last step.",
    preview: "Confirm your email to finish setting up your account.",
    body: "Thanks for creating an account. Verify your email to finish setting up your account.",
    action: "Verify email",
    reassurance: "Only verify this email if you created this account.",
    unsolicited: "If you didn’t create an account, you can ignore this email.",
  },
  recovery: {
    subject: "Reset your password",
    heading: "A fresh start.",
    preview: "Choose a new password for your account.",
    body: "We received a request to reset your password. Use the button below to choose a new one.",
    action: "Reset password",
    reassurance:
      "Your current password will keep working until you save a new one.",
    unsolicited: "If you didn’t request a reset, you can ignore this email.",
  },
  email_change: {
    subject: "Confirm your email change",
    heading: "Confirm it’s you.",
    preview: "Confirm the email change requested for your account.",
    body: "An email address change was requested for your account. Confirm this step using the button below. You may also need to confirm from your other address.",
    action: "Confirm email change",
    reassurance: "Only confirm this change if you requested it.",
    unsolicited:
      "If you didn’t request this change, contact us using the address below.",
  },
  magic_link: {
    subject: "Your sign-in link",
    heading: "Welcome back.",
    preview: "Use this secure link to sign in to your account.",
    body: "Use the button below to sign in and pick up where you left off.",
    action: "Sign in",
    reassurance: "Keep this link private. It provides access to your account.",
    unsolicited: "If you didn’t request this link, you can ignore this email.",
  },
  invite: {
    subject: "Your account invitation",
    heading: "You’re invited.",
    preview: "Set up your account to get started.",
    body: "You’ve been invited to create an account. Use the button below to get started.",
    action: "Accept invitation",
    reassurance:
      "Keep this invitation private. It provides access to your account.",
    unsolicited:
      "If you weren’t expecting this invitation, you can ignore this email.",
  },
  reauthentication: {
    subject: "Your verification code",
    heading: "A quick check.",
    preview: "Use this code to confirm it’s you.",
    body: "Enter this verification code on the page where you requested it to continue.",
    action: "",
    reassurance: "Keep this code private. We won’t ask you to send it to us.",
    unsolicited: "If you didn’t request this code, you can ignore this email.",
  },
} satisfies Record<AuthEmailKind, AuthEmailCopy>;

export interface EmailLayoutProps {
  brand: EmailBrand;
  preview: string;
  siteUrl?: string;
  children?: React.ReactNode;
}
export function EmailLayout({
  brand,
  preview,
  siteUrl = "{{ .SiteURL }}",
  children,
}: EmailLayoutProps) {
  return (
    <Html lang="en">
      <Head>
        <meta name="color-scheme" content="dark" />
        <meta name="supported-color-schemes" content="dark" />
      </Head>
      <Body
        style={{
          margin: 0,
          backgroundColor: "#151518",
          color: "#f4f4f5",
          fontFamily: "Arial, Helvetica, sans-serif",
        }}
      >
        <div
          style={{
            display: "none",
            maxHeight: 0,
            overflow: "hidden",
            opacity: 0,
          }}
        >
          {preview}
        </div>
        <Container
          style={{ maxWidth: "560px", width: "100%", margin: "0 auto" }}
        >
          <Section style={{ padding: "40px 24px 28px" }}>
            <Link
              href={siteUrl}
              style={{
                color: "#f4f4f5",
                fontSize: "25px",
                fontWeight: 700,
                letterSpacing: "-1px",
                textDecoration: "none",
                borderBottom: brand.logo
                  ? undefined
                  : `2px solid ${brand.accentColor || "#2563eb"}`,
                paddingBottom: "5px",
              }}
            >
              {brand.logo ? (
                <Img
                  src={brand.logo.src}
                  width={brand.logo.width}
                  height={brand.logo.height}
                  alt={brand.logo.alt || brand.name}
                  style={{
                    display: "block",
                    maxWidth: "100%",
                    height: "auto",
                    border: 0,
                  }}
                />
              ) : (
                brand.wordmark || brand.name
              )}
            </Link>
          </Section>
          <Section
            style={{
              backgroundColor: "#202024",
              color: "#f4f4f5",
              border: "1px solid #37373e",
              borderTop: `3px solid ${brand.accentColor || "#2563eb"}`,
              padding: "32px 24px",
            }}
          >
            {children}
          </Section>
          <Section style={{ padding: "26px 24px 40px" }}>
            {brand.supportEmail && (
              <Text
                style={{
                  color: "#a1a1aa",
                  fontSize: "13px",
                  lineHeight: "22px",
                  margin: "0 0 14px",
                }}
              >
                Need a hand?{" "}
                <Link
                  href={`mailto:${brand.supportEmail}`}
                  style={{ color: "#f0a7cc", textDecoration: "underline" }}
                >
                  {brand.supportEmail}
                </Link>
              </Text>
            )}
            <Text
              style={{
                color: "#8f8f9a",
                fontSize: "12px",
                lineHeight: "20px",
                margin: 0,
              }}
            >
              {brand.name}
              <br />
              {brand.tagline}
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

export function AccountAction({
  kind,
  brand,
  message,
  siteUrl,
  actionUrl,
  code,
}: AuthEmailTemplateProps) {
  const text = {
    color: "#b9bec9",
    fontSize: "16px",
    lineHeight: "26px",
    margin: "0 0 20px",
  };
  return (
    <EmailLayout brand={brand} preview={message.preview} siteUrl={siteUrl}>
      <Text
        style={{
          color: "#a1a1aa",
          fontSize: "11px",
          letterSpacing: "2px",
          lineHeight: "16px",
          margin: "0 0 20px",
          fontWeight: 700,
        }}
      >
        YOUR ACCOUNT
      </Text>
      <Heading
        as="h1"
        style={{
          color: "#fafafa",
          fontSize: "32px",
          lineHeight: "38px",
          letterSpacing: "-1px",
          margin: "0 0 20px",
        }}
      >
        {message.heading}
      </Heading>
      <Text style={text}>{message.body}</Text>
      {kind === "reauthentication" ? (
        <Text
          style={{
            color: "#fafafa",
            backgroundColor: "#151518",
            border: "1px solid #45454d",
            padding: "18px",
            textAlign: "center",
            fontFamily: "monospace",
            fontSize: "30px",
            letterSpacing: "6px",
          }}
        >
          {code}
        </Text>
      ) : (
        <Button
          href={actionUrl}
          style={{
            backgroundColor: brand.accentColor || "#2563eb",
            borderRadius: "4px",
            color: "#ffffff",
            padding: "15px 24px",
            fontSize: "16px",
            lineHeight: "20px",
            fontWeight: 700,
            textDecoration: "none",
            textAlign: "center",
          }}
        >
          {message.action}
        </Button>
      )}
      <Text
        style={{
          ...text,
          fontSize: "13px",
          lineHeight: "21px",
          margin: "20px 0 0",
        }}
      >
        {message.linkHint ??
          (kind === "reauthentication"
            ? "This code expires and can only be used once."
            : "This link expires and can only be used once. Open it in the browser where you started.")}
      </Text>
      <Hr
        style={{
          border: 0,
          borderTop: "1px solid #3b3b43",
          margin: "28px 0",
        }}
      />
      <Text style={{ ...text, fontSize: "14px", lineHeight: "23px" }}>
        {message.reassurance}
      </Text>
      <Text
        style={{
          ...text,
          color: "#a1a1aa",
          fontSize: "13px",
          lineHeight: "21px",
          marginBottom: 0,
        }}
      >
        {message.unsolicited}
      </Text>
    </EmailLayout>
  );
}
