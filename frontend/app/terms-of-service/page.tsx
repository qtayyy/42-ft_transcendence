"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/context/languageContext";

export default function TermsOfServicePage() {
  const { t } = useLanguage();
  const s = t["Terms of Service"];

  return (
    <div className="min-h-screen w-full px-4 py-16 flex flex-col items-center">
      <div className="w-full max-w-3xl space-y-6">
        {/* Header */}
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-3xl font-bold">{s["title"]}</CardTitle>
            <p className="text-muted-foreground text-sm mt-1">{s["last updated"]} 2026-05-12</p>
          </CardHeader>
        </Card>

        {/* Content */}
        <Card>
          <CardContent className="pt-6 space-y-6 text-sm leading-relaxed">

            <section>
              <h2 className="text-lg font-semibold mb-2">{s["1 title"]}</h2>
              <p className="text-muted-foreground">{s["1 body"]}</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold mb-2">{s["2 title"]}</h2>
              <ul className="list-disc list-inside text-muted-foreground space-y-1">
                <li>{s["2 item1"]}</li>
                <li>{s["2 item2"]}</li>
                <li>{s["2 item3"]}</li>
                <li>{s["2 item4"]}</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold mb-2">{s["3 title"]}</h2>
              <p className="text-muted-foreground">{s["3 body"]}</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold mb-2">{s["4 title"]}</h2>
              <p className="text-muted-foreground">{s["4 body"]}</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold mb-2">{s["5 title"]}</h2>
              <p className="text-muted-foreground">{s["5 body"]}</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold mb-2">{s["6 title"]}</h2>
              <p className="text-muted-foreground">{s["6 body"]}</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold mb-2">{s["7 title"]}</h2>
              <p className="text-muted-foreground">{s["7 body"]}</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold mb-2">{s["8 title"]}</h2>
              <p className="text-muted-foreground">{s["8 body"]}</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold mb-2">{s["9 title"]}</h2>
              <p className="text-muted-foreground">{s["9 body"]}</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold mb-2">{s["10 title"]}</h2>
              <p className="text-muted-foreground">{s["10 body"]}</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold mb-2">{s["11 title"]}</h2>
              <p className="text-muted-foreground">{s["11 body"]}</p>
            </section>

            <div className="flex flex-wrap gap-3 pt-4">
              <Link href="/login">
                <Button variant="outline">{s["Back to Login"]}</Button>
              </Link>
              <Link href="/privacy-policy">
                <Button variant="ghost">{s["Privacy Policy link"]}</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
