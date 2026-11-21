import Link from "next/link";
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  Building2,
  CheckCheck,
  Clock3,
  Code2,
  Database,
  FileArchive,
  FileLock2,
  FolderKanban,
  Layers3,
  LockKeyhole,
  ShieldCheck,
  Upload,
  Users,
  Zap,
} from "lucide-react";
import {
  formatFileSize,
  MAX_SHARE_BYTES,
  MAX_SHARE_FILE_BYTES,
  MAX_SHARE_FILES,
  MIN_FILE_BYTES,
} from "@repo/types";
import styles from "./page.module.css";

const dashboardUrl = (
  process.env.NEXT_PUBLIC_DASHBOARD_URL || "http://localhost:3001"
).replace(/\/$/, "");
const features = [
  {
    icon: Building2,
    title: "A home for every team",
    tag: "Organizations",
    text: "Create separate organizations and switch between them. Keep each team’s people, projects and file handoffs together.",
  },
  {
    icon: Users,
    title: "The right people. The right access.",
    tag: "Members & roles",
    text: "Invite teammates with seven-day links. Admins manage members, moderators and admins; the last admin is protected.",
  },
  {
    icon: FolderKanban,
    title: "Keep projects in context",
    tag: "Projects",
    text: "Members create and edit project names and descriptions. Creators, moderators and admins can delete them. Attach file shares to a project.",
  },
  {
    icon: ShieldCheck,
    title: "Oversight at a glance",
    tag: "Platform admin",
    text: "A separate console lets the configured platform administrator inspect organizations, member roles, projects and share counts.",
  },
];
const stack = [
  {
    icon: Code2,
    name: "Next.js + React",
    text: "Three apps: public website, team dashboard and restricted admin console.",
  },
  {
    icon: Layers3,
    name: "TypeScript + Tailwind CSS",
    text: "Typed application code and reusable, responsive UI components.",
  },
  {
    icon: Database,
    name: "PostgreSQL + Prisma",
    text: "Shared relational storage for accounts, organizations, projects and share metadata.",
  },
  {
    icon: LockKeyhole,
    name: "Auth.js + bcrypt",
    text: "Email/password sign-in, hashed passwords and JWT sessions.",
  },
  {
    icon: ShieldCheck,
    name: "Arcjet + rate limits",
    text: "Request protection with shared PostgreSQL counters when Arcjet is unconfigured.",
  },
  {
    icon: Zap,
    name: "pnpm + Turborepo",
    text: "A monorepo that shares types, auth and UI across all three applications.",
  },
];

export default function HomePage() {
  return (
    <div className={styles.page}>
      <a href="#main" className={styles.skip}>
        Skip to content
      </a>
      <header className={styles.header}>
        <nav
          aria-label="Main navigation"
          className={`${styles.container} ${styles.nav}`}
        >
          <Link href="/" className={styles.brand}>
            <span className={styles.brandIcon}>
              <Layers3 size={20} aria-hidden="true" />
            </span>
            SaaSFlow<span className={styles.brandDot}>.</span>
          </Link>
          <div className={styles.navLinks}>
            <a href="#workspace">Workspace</a>
            <a href="#secure-drop">Secure Drop</a>
            <a href="#technology">Under the hood</a>
          </div>
          <Link href={`${dashboardUrl}/auth/sign-in`} className={styles.signIn}>
            Sign in <ArrowUpRight size={15} aria-hidden="true" />
          </Link>
        </nav>
      </header>
      <main id="main">
        <section className={`${styles.container} ${styles.hero}`}>
          <div>
            <p className={styles.eyebrow}>
              <span className={styles.liveDot} /> YOUR TEAM. IN FLOW.
            </p>
            <h1>
              Less scattered.
              <br />
              More <span className={styles.gradientText}>together.</span>
            </h1>
            <p className={styles.intro}>
              One workspace for your people, projects and private file handoffs.
              Bring your team in. Keep the work moving.
            </p>
            <div className={styles.actions}>
              <Link
                href={`${dashboardUrl}/auth/sign-up`}
                className={styles.primary}
              >
                Create your workspace{" "}
                <ArrowRight size={18} aria-hidden="true" />
              </Link>
              <a href="#workspace" className={styles.secondary}>
                Explore the features <ArrowDown size={16} aria-hidden="true" />
              </a>
            </div>
            <p className={styles.heroNote}>
              Team workspaces <span>·</span> Role-based access <span>·</span>{" "}
              Expiring links
            </p>
          </div>
          <div className={styles.previewWrap}>
            <div
              className={styles.preview}
              aria-label="Illustrative workspace preview with example data"
            >
              <div className={styles.previewTop}>
                <div className={styles.windowDots} aria-hidden="true">
                  <i />
                  <i />
                  <i />
                </div>
                <span>Workspace preview · example data</span>
                <LockKeyhole size={12} aria-hidden="true" />
              </div>
              <div className={styles.previewBody}>
                <div className={styles.previewSidebar} aria-hidden="true">
                  <span className={styles.miniBrand}>
                    <Layers3 size={17} /> Acme studio
                  </span>
                  <span className={styles.selected}>
                    <FolderKanban size={14} /> Projects
                  </span>
                  <span>
                    <Users size={14} /> Members
                  </span>
                  <span>
                    <FileLock2 size={14} /> Secure Drop
                  </span>
                  <div className={styles.sidebarBottom}>
                    A space for good work.
                  </div>
                </div>
                <div className={styles.previewContent}>
                  <div className={styles.previewLabel}>
                    ACME STUDIO / OVERVIEW
                  </div>
                  <h2>Your next big thing.</h2>
                  <p>Good people. Everything in one place.</p>
                  <div className={styles.miniStats}>
                    <div>
                      <strong>03</strong>
                      <span>Projects</span>
                    </div>
                    <div>
                      <strong>08</strong>
                      <span>Teammates</span>
                    </div>
                    <div>
                      <strong>02</strong>
                      <span>Active drops</span>
                    </div>
                  </div>
                  <div className={styles.projectRow}>
                    <span className={styles.projectIcon}>
                      <FolderKanban size={18} aria-hidden="true" />
                    </span>
                    <div>
                      <strong>Website refresh</strong>
                      <span>Design & development</span>
                    </div>
                  </div>
                  <div className={styles.projectRow}>
                    <span className={styles.projectIcon}>
                      <FileArchive size={18} aria-hidden="true" />
                    </span>
                    <div>
                      <strong>Client handoff</strong>
                      <span>Assets, ready to share</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className={styles.floatingDrop}>
              <span className={styles.successIcon}>
                <CheckCheck size={20} aria-hidden="true" />
              </span>
              <div>
                <strong>Handoff, handled.</strong>
                <span>Secure Drop · link ready to share</span>
              </div>
              <ShieldCheck size={19} aria-hidden="true" />
            </div>
          </div>
        </section>
        <section
          className={`${styles.container} ${styles.useCases}`}
          aria-label="What SaaSFlow is useful for"
        >
          <span>BUILT FOR THE HANDOFF</span>
          <p>
            <FolderKanban size={17} aria-hidden="true" /> Small team projects
          </p>
          <p>
            <Users size={17} aria-hidden="true" /> Client collaboration
          </p>
          <p>
            <FileArchive size={17} aria-hidden="true" /> Design & asset delivery
          </p>
        </section>
        <section
          id="workspace"
          className={`${styles.container} ${styles.section}`}
        >
          <div className={styles.sectionHeading}>
            <div>
              <p className={styles.eyebrow}>01 / THE WORKSPACE</p>
              <h2>Give the work a home.</h2>
            </div>
            <p>
              From the first invite to the final file.
              <br />
              The essentials, without the clutter.
            </p>
          </div>
          <div className={styles.featureGrid}>
            {features.map(({ icon: Icon, title, tag, text }, i) => (
              <article key={tag} className={styles.featureCard}>
                <div className={styles.cardTop}>
                  <span className={styles.iconBox}>
                    <Icon size={22} aria-hidden="true" />
                  </span>
                  <span className={styles.cardNumber}>0{i + 1}</span>
                </div>
                <span className={styles.tag}>{tag}</span>
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </section>
        <section
          id="secure-drop"
          className={`${styles.container} ${styles.section}`}
        >
          <div className={styles.dropPanel}>
            <div className={styles.dropIntro}>
              <p className={styles.eyebrow}>
                <FileLock2 size={16} aria-hidden="true" /> 02 / SECURE DROP
              </p>
              <h2>
                Big files.
                <br />
                Small window.
                <br />
                <span className={styles.gradientText}>Your control.</span>
              </h2>
              <p>
                Send files or a folder with an expiring link. Recipients browse
                and download individual files without creating an account.
              </p>
              <a
                href={`${dashboardUrl}/auth/sign-in`}
                className={styles.textLink}
              >
                Open Secure Drop <ArrowUpRight size={17} aria-hidden="true" />
              </a>
              <div className={styles.dropBadge}>
                <ShieldCheck size={16} aria-hidden="true" /> AES-256-GCM
                encryption at rest
              </div>
            </div>
            <div className={styles.dropDetails}>
              <ol className={styles.steps}>
                {[
                  {
                    icon: Upload,
                    title: "Pick it. Upload it.",
                    text: "Select files or a folder; paths stay intact. Optionally attach a project. Watch chunked upload progress with retries for interrupted chunks.",
                  },
                  {
                    icon: Clock3,
                    title: "Set the window.",
                    text: "Choose 1 hour, 24 hours or 7 days from publication. Allow repeat downloads or one claim per file, then copy the finished link.",
                  },
                  {
                    icon: CheckCheck,
                    title: "Share. Track. Revoke.",
                    text: "See expiry, status and download counts. Revoke your links anytime; organization admins can also review and revoke team shares.",
                  },
                ].map(({ icon: Icon, title, text }, i) => (
                  <li key={title}>
                    <span className={styles.stepIcon}>
                      <Icon size={19} aria-hidden="true" />
                    </span>
                    <div>
                      <span className={styles.stepNumber}>STEP 0{i + 1}</span>
                      <h3>{title}</h3>
                      <p>{text}</p>
                    </div>
                  </li>
                ))}
              </ol>
              <dl className={styles.limits}>
                {[
                  [formatFileSize(MAX_SHARE_FILE_BYTES), "per file"],
                  [String(MAX_SHARE_FILES), "files per share"],
                  [formatFileSize(MAX_SHARE_BYTES), "per share"],
                ].map(([value, label]) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
              <p className={styles.limitNote}>
                Files from {formatFileSize(MIN_FILE_BYTES)}. Folders preserve
                paths; empty directories are omitted.
              </p>
            </div>
          </div>
          <div className={styles.faqs}>
            <details open>
              <summary>What files can I send?</summary>
              <p>
                Any file type: PDFs, Word documents, spreadsheets,
                presentations, photos, audio, videos, ZIP/RAR/7Z archives,
                source code and even software such as EXE or APK files. There is
                no file-extension or content-type restriction. Select individual
                files or a folder; folder paths are preserved, but empty folders
                are omitted.
              </p>
              <p>
                Each file must be {formatFileSize(MIN_FILE_BYTES)} to{" "}
                {formatFileSize(MAX_SHARE_FILE_BYTES)}. A share supports up to{" "}
                {MAX_SHARE_FILES} files and {formatFileSize(MAX_SHARE_BYTES)}{" "}
                total. Empty files, oversized selections, duplicate file paths,
                unsafe names or paths, and uploads exceeding organization quotas
                are rejected. Files are not scanned for malware: only open files
                from senders you trust.
              </p>
            </details>
            <details>
              <summary>How does Secure Drop work behind the scenes?</summary>
              <p>
                Your browser splits files into 4 MiB pieces and uploads them to
                the SaaSFlow server. The server checks your team membership,
                file sizes and piece order, then encrypts the pieces on private
                disk. PostgreSQL stores file details and upload progress. Once
                every file is ready, you receive an expiring link.
              </p>
              <p>
                When a recipient opens the link, the server checks access,
                decrypts the pieces and streams the selected file to their
                browser. Scheduled cleanup removes eligible expired or revoked
                files. This is server-stored sharing, not a direct transfer
                between devices. The sender can go offline after uploading.
              </p>
            </details>
            <details>
              <summary>When is it useful, and is it faster?</summary>
              <p>
                Deliver client assets, project folders or team documents without
                asking recipients to install an app or create an account. Keep
                handoffs connected to a project, choose an expiry and revoke
                future access when needed. Downloaded copies cannot be recalled.
              </p>
              <p>
                Small upload pieces allow progress updates and retries, while
                streaming avoids loading a whole large file into server memory.
                Uploads are sequential; speed depends on your connection and the
                server’s bandwidth, disk and database. There is no benchmark
                showing it is faster than other sharing tools. Closing the
                browser ends an unfinished upload; returning later does not
                resume it.
              </p>
            </details>
            <details>
              <summary>What does “secure” mean here?</summary>
              <p>
                Files are encrypted on the server at rest; the server can
                decrypt them for delivery. Share tokens are stored as hashes.
                File names and sizes remain visible to the service. Anyone
                holding a link has access: keep it private. Recipient identity
                is not verified, and files are not scanned for malware. This is
                encryption at rest, not end-to-end file encryption.
              </p>
            </details>
            <details>
              <summary>How do one-time downloads and revocation work?</summary>
              <p>
                Viewing the list does not claim files. Starting a download uses
                that file’s one-time claim, even if the transfer later fails; a
                new share may be needed. Revocation blocks new downloads; an
                already running response can finish. Closing the browser
                interrupts unfinished uploads.
              </p>
            </details>
            <details>
              <summary>What are the workspace storage limits?</summary>
              <p>
                Each organization can hold 20 active shares or drafts and
                reserve up to 50 GiB. Drafts expire after 24 hours. Expired or
                revoked files count toward storage until scheduled cleanup
                removes them.
              </p>
            </details>
          </div>
        </section>
        <section
          id="technology"
          className={`${styles.container} ${styles.section}`}
        >
          <div className={styles.sectionHeading}>
            <div>
              <p className={styles.eyebrow}>03 / UNDER THE HOOD</p>
              <h2>A modern stack. A clear purpose.</h2>
            </div>
            <p>
              Three focused apps.
              <br />
              One shared foundation.
            </p>
          </div>
          <div className={styles.stackGrid}>
            {stack.map(({ icon: Icon, name, text }) => (
              <article key={name} className={styles.stackCard}>
                <Icon size={20} aria-hidden="true" />
                <div>
                  <h3>{name}</h3>
                  <p>{text}</p>
                </div>
              </article>
            ))}
          </div>
          <div className={styles.architecturePanel}>
            <span className={styles.iconBox}>
              <FileLock2 size={23} aria-hidden="true" />
            </span>
            <div>
              <p className={styles.eyebrow}>HOW SECURE DROP IS BUILT</p>
              <h3>Your browser. Our server. A simple handoff.</h3>
              <p>
                Secure Drop is built into SaaSFlow using Next.js server APIs,
                Node.js and PostgreSQL. Upload once, share the link and let
                recipients download later?even when you are offline.
              </p>
              <div className={styles.architectureModes}>
                <p>
                  <strong>01 / Upload in pieces</strong> Your browser sends 4
                  MiB chunks with progress updates and retries for interrupted
                  requests. The server checks your account, team access and file
                  limits before accepting the upload.
                </p>
                <p>
                  <strong>02 / Store encrypted</strong> Node.js encrypts file
                  chunks with AES-256-GCM on private persistent disk. Prisma
                  records file details, upload progress and access rules in
                  PostgreSQL; only a hash of the share token is stored.
                </p>
                <p>
                  <strong>03 / Deliver on demand</strong> The server checks the
                  link?s expiry and download policy, then decrypts and streams
                  the file to the recipient. Scheduled cleanup removes eligible
                  expired or revoked files.
                </p>
              </div>
              <p className={styles.architectureNote}>
                The server can decrypt files for delivery. Anyone with the link
                can access it until its policy blocks access. No recipient
                account or extra software is required.
              </p>
            </div>
          </div>
        </section>
        <section className={`${styles.container} ${styles.cta}`}>
          <p className={styles.eyebrow}>LESS FRICTION. MORE FLOW.</p>
          <h2>Your next project starts here.</h2>
          <p>Create an account, bring your team and make the first handoff.</p>
          <Link
            href={`${dashboardUrl}/auth/sign-up`}
            className={styles.primary}
          >
            Get started with SaaSFlow{" "}
            <ArrowRight size={18} aria-hidden="true" />
          </Link>
        </section>
      </main>
      <footer className={`${styles.container} ${styles.footer}`}>
        <Link href="/" className={styles.brand}>
          <Layers3 size={19} aria-hidden="true" /> SaaSFlow
          <span className={styles.brandDot}>.</span>
        </Link>
        <p>People, projects and handoffs. In flow.</p>
        <a href="#main">Back to top ↑</a>
      </footer>
    </div>
  );
}
