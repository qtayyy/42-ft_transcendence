"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/context/languageContext";

export default function PrivacyPolicyPage() {
  const { t } = useLanguage();
  const p = t["Privacy Policy"];
  const router = useRouter();

  return (
    <div className="min-h-screen w-full px-4 py-16 flex flex-col items-center">
      <div className="w-full max-w-3xl space-y-6">
        {/* Header */}
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-3xl font-bold">{p["title"]}</CardTitle>
            <p className="text-muted-foreground text-sm mt-1">{p["last updated"]} 2026-05-12</p>
          </CardHeader>
        </Card>

        {/* Content */}
        <Card>
          <CardContent className="pt-6 space-y-6 text-sm leading-relaxed">

            <section>
              <h2 className="text-lg font-semibold mb-2">{p["1 title"]}</h2>
              <p className="text-muted-foreground">{p["1 body"]}</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold mb-2">{p["2 title"]}</h2>
              <ul className="list-disc list-inside text-muted-foreground space-y-1">
                <li><strong>{p["account label"]}</strong> {p["account body"]}</li>
                <li><strong>{p["google label"]}</strong> {p["google body"]}</li>
                <li><strong>{p["profile label"]}</strong> {p["profile body"]}</li>
                <li><strong>{p["gameplay label"]}</strong> {p["gameplay body"]}</li>
                <li><strong>{p["chat label"]}</strong> {p["chat body"]}</li>
                <li><strong>{p["activity label"]}</strong> {p["activity body"]}</li>
                <li><strong>{p["session label"]}</strong> {p["session body"]}</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold mb-2">{p["3 title"]}</h2>
              <ul className="list-disc list-inside text-muted-foreground space-y-1">
                <li>{p["3 item1"]}</li>
                <li>{p["3 item2"]}</li>
                <li>{p["3 item3"]}</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold mb-2">{p["4 title"]}</h2>
              <p className="text-muted-foreground">{p["4 body"]}</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold mb-2">{p["5 title"]}</h2>
              <p className="text-muted-foreground">{p["5 body"]}</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold mb-2">{p["6 title"]}</h2>
              <p className="text-muted-foreground">{p["6 body"]}</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold mb-2">{p["7 title"]}</h2>
              <p className="text-muted-foreground">{p["7 body"]}</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold mb-2">{p["8 title"]}</h2>
              <p className="text-muted-foreground">{p["8 body"]}</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold mb-2">{p["9 title"]}</h2>
              <p className="text-muted-foreground">{p["9 body"]}</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold mb-2">{p["10 title"]}</h2>
              <p className="text-muted-foreground">{p["10 body"]}</p>
            </section>

            <div className="flex flex-wrap gap-3 pt-4">
              <Button variant="outline" onClick={() => router.back()}>{p["Back to Sign Up"]}</Button>
              <Link href="/terms-of-service">
                <Button variant="ghost">{p["Terms of Service link"]}</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
