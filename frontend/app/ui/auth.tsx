"use client";
import axios from "axios";
import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/shadcn-io/tabs";
import { AlertCircleIcon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export function AuthDialog({ text }: { text: string }) {
  const [tab, setTab] = useState(text === "Sign In" ? "signIn" : "signUp");
  const [errorMessage, setErrorMessage] = useState("");
  const formRef = useRef<HTMLFormElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const data = Object.fromEntries(new FormData(form).entries());

    setErrorMessage("");

    const email = (data.email || "").toString().trim();
    const password = (data.password || "").toString().trim();
    const fullName = (data.fullName || "").toString().trim();

    if (!email || !password || (tab === "signUp" && !fullName)) {
      setErrorMessage("Please fill in all required fields.");
      return;
    }

    if (password.length < 6) {
      setErrorMessage("Password must be at least 6 characters long.");
      return;
    }

    try {
      const endpoint =
        tab === "signIn" ? "/api/auth/login" : "/api/auth/register";
      const response = await axios.post(endpoint, data);
      console.log("Response:", response.data);
    } catch (error: any) {
      const backendError = error.response?.data?.error;
      setErrorMessage(backendError || "Something went wrong. Please try again later.");
    }
  };

  return (
    <Dialog
      onOpenChange={(open) => {
        if (!open) setErrorMessage("");
      }}
    >
      <DialogTrigger asChild>
        <Button className="p-5" variant="outline">
          {text}
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle>Sign in or sign up here!</DialogTitle>
        </DialogHeader>

        <Tabs
          value={tab}
          onValueChange={(value) => {
            setTab(value);
            setErrorMessage("");
            formRef.current?.reset();
          }}
          className="w-[400px] bg-muted rounded-lg mt-4"
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="signIn">Sign In</TabsTrigger>
            <TabsTrigger value="signUp">Sign Up</TabsTrigger>
          </TabsList>

          <form ref={formRef} onSubmit={handleSubmit}>
            {tab === "signIn" ? (
              <TabsContent value="signIn" className="space-y-6 p-6">
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label htmlFor="email">Email</Label>
                    <Input type="email" id="email" name="email" />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="password">Password</Label>
                    <Input type="password" id="password" name="password" />
                  </div>
                </div>
                {errorMessage && (
                  <Alert variant="destructive">
                    <AlertCircleIcon className="h-4 w-4" />
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{errorMessage}</AlertDescription>
                  </Alert>
                )}

                <Button className="w-full" type="submit">
                  Sign In
                </Button>
                <Button className="w-full" type="button">
                  Continue with Google (placeholder)
                </Button>
              </TabsContent>
            ) : (
              <TabsContent value="signUp" className="space-y-6 p-6">
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label htmlFor="fullName">Full Name</Label>
                    <Input type="text" id="fullName" name="fullName" />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="email">Email</Label>
                    <Input type="email" id="email" name="email" />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="password">Password</Label>
                    <Input type="password" id="password" name="password" />
                  </div>
                </div>
                {errorMessage && (
                  <Alert variant="destructive">
                    <AlertCircleIcon className="h-4 w-4" />
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{errorMessage}</AlertDescription>
                  </Alert>
                )}

                <Button className="w-full" type="submit">
                  Sign Up
                </Button>
                <Button className="w-full" type="button">
                  Continue with Google (placeholder)
                </Button>
              </TabsContent>
            )}
          </form>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
