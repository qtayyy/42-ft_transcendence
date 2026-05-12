import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const metadata = {
  title: "Terms of Service – ft_transcendence",
  description: "Terms of Service for ft_transcendence",
};

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen w-full px-4 py-16 flex flex-col items-center">
      <div className="w-full max-w-3xl space-y-6">
        {/* Header */}
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-3xl font-bold">Terms of Service</CardTitle>
            <p className="text-muted-foreground text-sm mt-1">Last updated: 2026-05-12</p>
          </CardHeader>
        </Card>

        {/* Content */}
        <Card>
          <CardContent className="pt-6 space-y-6 text-sm leading-relaxed">

            <section>
              <h2 className="text-lg font-semibold mb-2">1. Acceptance of Terms</h2>
              <p className="text-muted-foreground">
                By accessing or using ft_transcendence (the "Platform"), you agree to be
                bound by these Terms of Service. If you do not agree to these terms, please
                do not use the Platform. This is an academic project created by 42 KL
                students and is not a commercial service.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold mb-2">2. Use of the Platform</h2>
              <ul className="list-disc list-inside text-muted-foreground space-y-1">
                <li>You must be a participant or evaluator of the 42 KL project to use this Platform.</li>
                <li>You agree to use the Platform only for lawful purposes and in accordance with these Terms.</li>
                <li>You may not attempt to gain unauthorized access to any part of the Platform or its infrastructure.</li>
                <li>You may not disrupt or interfere with the Platform's availability or the experience of other users.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold mb-2">3. User Accounts</h2>
              <p className="text-muted-foreground">
                You are responsible for maintaining the security of your account credentials.
                You must not share your password with others. The team reserves the right to
                suspend or delete accounts that violate these Terms or abuse the Platform.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold mb-2">4. User-Generated Content</h2>
              <p className="text-muted-foreground">
                You are solely responsible for any content you submit to the Platform,
                including chat messages, display names, and avatars. You agree not to post
                content that is harmful, abusive, hateful, obscene, or that infringes on any
                third-party rights. The team reserves the right to remove any content that
                violates these standards.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold mb-2">5. Fair Play</h2>
              <p className="text-muted-foreground">
                You agree to participate in games and tournaments fairly. Attempts to cheat,
                exploit bugs for competitive advantage, or otherwise manipulate game outcomes
                are prohibited and may result in account suspension.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold mb-2">6. Intellectual Property</h2>
              <p className="text-muted-foreground">
                The Platform and its original content (excluding user-generated content) are
                the work of the 42 KL student team. The project is developed for
                educational purposes. The Pong game concept is a reference to the classic
                arcade game and is used for academic learning.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold mb-2">7. Disclaimer of Warranties</h2>
              <p className="text-muted-foreground">
                The Platform is provided on an "as-is" and "as-available" basis for academic
                evaluation. We make no warranties, express or implied, regarding uptime,
                availability, or fitness for any particular purpose. The Platform may
                experience downtime, data loss, or other issues inherent to a development
                environment.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold mb-2">8. Limitation of Liability</h2>
              <p className="text-muted-foreground">
                To the fullest extent permitted by law, the team shall not be liable for any
                indirect, incidental, or consequential damages arising from your use of the
                Platform. As this is a non-commercial academic project, no financial
                compensation or service guarantees are implied.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold mb-2">9. Termination</h2>
              <p className="text-muted-foreground">
                The team reserves the right to terminate or suspend access to the Platform
                at any time, for any reason, including violations of these Terms. Upon
                termination, your right to use the Platform will immediately cease.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold mb-2">10. Changes to These Terms</h2>
              <p className="text-muted-foreground">
                These Terms may be updated at any time. The "last updated" date at the top
                reflects the most recent revision. Continued use of the Platform after
                changes constitutes acceptance of the updated Terms.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold mb-2">11. Contact</h2>
              <p className="text-muted-foreground">
                For questions about these Terms, open an issue on the project repository or
                contact the team via 42 intra.
              </p>
            </section>

            <div className="flex flex-wrap gap-3 pt-4">
              <Link href="/login">
                <Button variant="outline">Back to Login</Button>
              </Link>
              <Link href="/privacy-policy">
                <Button variant="ghost">Privacy Policy</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
