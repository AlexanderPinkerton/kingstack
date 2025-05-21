import { makeAutoObservable, runInAction } from "mobx";
import { PostStore } from "./postStore";

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
);

export class RootStore {
  postStore: PostStore;
  session: any;

  constructor() {

    console.log("RootStore constructor", Math.random());

    this.postStore = new PostStore(this);
    this.session = null;

    supabase.auth.onAuthStateChange((event, session) => {
      console.log("Auth state changed:", event, session);
      runInAction(() => {
        this.session = session;
      });
    });

    
    console.log("RootStore initialized.");

    makeAutoObservable(this);
  }

  async refreshSession() {
    const result = await supabase.auth.getSession();
    runInAction(() => {
      this.session = result;
    });
  }
}
