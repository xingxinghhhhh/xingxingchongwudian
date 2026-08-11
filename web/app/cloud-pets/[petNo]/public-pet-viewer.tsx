"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getCurrentMemberProfile } from "../../member/member-api";
import {
  resolvePublicPetViewerMode,
  type PublicPetViewerMode
} from "./public-pet-viewer-mode";

const memberSessionKey = "kzt_member_session";

interface PublicPetViewerProps {
  petNo: string;
}

export function PublicPetViewer({ petNo }: PublicPetViewerProps) {
  const [mode, setMode] = useState<PublicPetViewerMode>("unknown");

  useEffect(() => {
    let active = true;

    async function loadViewerMode() {
      const sessionToken = window.localStorage.getItem(memberSessionKey);
      if (!sessionToken) {
        if (active) {
          setMode("visitor");
        }
        return;
      }

      try {
        const profile = await getCurrentMemberProfile(sessionToken);
        if (active) {
          setMode(
            resolvePublicPetViewerMode({
              authStatus: "authenticated",
              ownedPetNos: profile.pets.map((pet) => pet.petNo),
              petNo
            })
          );
        }
      } catch {
        if (active) {
          setMode("visitor");
        }
      }
    }

    void loadViewerMode();
    return () => {
      active = false;
    };
  }, [petNo]);

  if (mode !== "owner") {
    return null;
  }

  return (
    <section className="pet-public-owner-view" data-testid="pet-public-owner-view">
      <p className="section__kicker">主人视角</p>
      <strong>这是你的宠物主页</strong>
      <p>可以返回云养宠工作台继续照顾和编辑主页。</p>
      <Link
        className="cloud-link-button cloud-link-button--compact"
        data-testid="pet-public-owner-workspace"
        href="/cloud-pets"
      >
        返回云养宠工作台
      </Link>
    </section>
  );
}
