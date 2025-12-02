"use client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";

export function AuthShell({
  title,
  description,
  children,
  fields,
  handleSubmit,
  link,
  linkText,
  submitText
}) {
  return (
    <div className="grid h-screen place-items-center">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl font-semibold">
            {title}
          </CardTitle>
          <CardDescription className="mb-3">{description}</CardDescription>
          <Link className="underline text-gray-400 hover:text-gray-200" href={link}>{linkText}</Link>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-6" onSubmit={handleSubmit}>
            <div className="flex flex-col gap-6">
              {fields.map((field) => (
                <div key={field.name} className="grid gap-2">
                  <Label htmlFor={field.name}>{field.label}</Label>
                  <Input
                    type={field.type}
                    id={field.name}
                    name={field.name}
                    required
                  />
                </div>
              ))}
            </div>
            {children}

            {/* Only render this footer button if submitText is provided */}
            {submitText && (
            <CardFooter className="flex-col gap-2">
              <Button className="w-full" type="submit">
                {submitText}
              </Button>
            </CardFooter>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
