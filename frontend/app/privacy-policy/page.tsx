import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const metadata = {
  title: "Privacy Policy – ft_transcendence",
  description: "Privacy Policy for ft_transcendence",
};

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen w-full px-4 py-16 flex flex-col items-center">
      <div className="w-full max-w-3xl space-y-6">
        {/* Header */}
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-3xl font-bold">Privacy Policy</CardTitle>
            <p className="text-muted-foreground text-sm mt-1">Last updated: 2026-05-12</p>
          </CardHeader>
        </Card>

        {/* Content */}
        <Card>
          <CardContent className="pt-6 space-y-6 text-sm leading-relaxed">

            <section>
              <h2 className="text-lg font-semibold mb-2">1. Who We Are</h2>
              <p className="text-muted-foreground">
                ft_transcendence is an academic project built by 42 KL students. It is not a
                commercial service. The platform is operated locally by the team for educational
                and evaluation purposes only.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold mb-2">2. What We Collect</h2>
              <ul className="list-disc list-inside text-muted-foreground space-y-1">
                <li>
                  <strong>Account:</strong> email address, username, hashed password (bcrypt),
                  and an optional avatar image you upload.
                </li>
                <li>
                  <strong>Google Sign-In (optional):</strong> if you choose to sign in with
                  Google, we receive your Google account email address and display name via
                  OAuth. We do not receive your Google password or any other Google account
                  data beyond what is needed to create and identify your account.
                </li>
                <li>
                  <strong>Profile:</strong> optional display name and bio you provide.
                </li>
                <li>
                  <strong>Gameplay:</strong> match history (opponents, scores, dates) and
                  tournament participation records.
                </li>
                <li>
                  <strong>Chat:</strong> messages you send in chat rooms and direct messages,
                  stored to render conversation history.
                </li>
                <li>
                  <strong>Activity:</strong> timestamps of logins and per-day counts of games
                  played and messages sent, used to power your activity dashboard.
                </li>
                <li>
                  <strong>Session:</strong> short-lived JSON Web Tokens stored in your browser
                  to keep you signed in.
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold mb-2">3. What We Do NOT Collect</h2>
              <ul className="list-disc list-inside text-muted-foreground space-y-1">
                <li>
                  We do not collect phone numbers, payment information, IP geolocation,
                  or any third-party tracking identifiers.
                </li>
                <li>We do not use advertising cookies or third-party analytics trackers.</li>
                <li>
                  We do not store any data from your Google account beyond the email address
                  and display name provided during OAuth sign-in.
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold mb-2">4. How We Use Your Data</h2>
              <p className="text-muted-foreground">
                Your data is used solely to operate the platform: authenticate you, render your
                profile, deliver real-time messages and game events, and compute the statistics
                shown on your dashboard. No data is used for marketing or profiling.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold mb-2">5. Sharing</h2>
              <p className="text-muted-foreground">
                We do not sell, rent, or share your data with third parties. Other registered
                users on the same instance can see your public profile (username, avatar,
                display name, match history, and any messages you send in shared rooms).
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold mb-2">6. Storage and Security</h2>
              <p className="text-muted-foreground">
                Data is stored in a SQLite database hosted alongside the application.
                Passwords are hashed with bcrypt and are never stored in plaintext.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold mb-2">7. Your Rights</h2>
              <p className="text-muted-foreground">
                You may request deletion of your account and all associated data at any time. Because this is an academic instance, deletion is
                performed manually upon request.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold mb-2">8. Cookies</h2>
              <p className="text-muted-foreground">
                This application uses only strictly necessary cookies (session tokens). No
                tracking or advertising cookies are set.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold mb-2">9. Changes to This Policy</h2>
              <p className="text-muted-foreground">
                This policy may be updated as the project evolves. The "last updated" date at
                the top of this page reflects the most recent revision.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold mb-2">10. Contact</h2>
              <p className="text-muted-foreground">
                For privacy-related questions, open an issue on the project repository or
                contact the team via 42 intra.
              </p>
            </section>

            <div className="flex flex-wrap gap-3 pt-4">
              <Link href="/login">
                <Button variant="outline">Back to Login</Button>
              </Link>
              <Link href="/terms-of-service">
                <Button variant="ghost">Terms of Service</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
