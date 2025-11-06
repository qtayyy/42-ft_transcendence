"use client";
import axios from "axios";
import { useState } from "react";
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

// To-do: show error msg if missing fields/invalid inputs/protect from xss
export function AuthDialog({ text }: { text: string }) {
  const [tab, setTab] = useState(text === "Sign In" ? "signIn" : "signUp");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const data = Object.fromEntries(new FormData(form).entries());
    
    try {
      const endpoint = tab === "signIn" ? "/api/auth/login" : "/api/auth/register";
      const response = await axios.post(endpoint, data);
      console.log("Response:", response.data);
    } catch (error) {
      console.error("Error:", error);
    }
  };

  return (
    <Dialog>
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
          onValueChange={setTab}
          className="w-[400px] bg-muted rounded-lg mt-4"
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="signIn">Sign In</TabsTrigger>
            <TabsTrigger value="signUp">Sign Up</TabsTrigger>
          </TabsList>

          <form onSubmit={handleSubmit}>
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
