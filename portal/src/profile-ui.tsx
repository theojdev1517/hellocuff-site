import React, { useEffect, useState } from "react";
import * as api from "./firebase";
import { emptyDraft, errorMessage, type OwnerModel } from "./owner-model";
import { AppLink } from "./navigation";
import { PhotoEditor } from "./PhotoEditor";
import {
  uploadPhoto,
  readPrivatePhoto,
  readPublicPhoto,
  cleanupPhotos,
  photoStorageReady,
  type ProcessedPhoto,
} from "./photos";
import {
  fields,
  palettes,
  modes,
  toVcf,
  vcfFilename,
  validateDraft,
  validateDraftFields,
  normalizeContact,
  normalizeField,
  formatUsPhone,
  defaultConfig,
  safeWebsite,
  safeEmail,
  safePhone,
  photoPolicy,
  type Draft,
  type Field,
  type PhotoMetadata,
} from "./domain";
const labels: Record<Field, string> = {
  name: "Name",
  company: "Company",
  title: "Title",
  phone: "Phone",
  publicEmail: "Public email",
  website: "Website",
  bio: "Short bio",
};
function usePhotoPreview(
  publicId: string,
  photo: PhotoMetadata | undefined,
  pending: ProcessedPhoto | null,
  publicRead: boolean,
) {
  const [loaded, setLoaded] = useState<{
    key: string;
    url?: string;
    error?: string;
  }>({ key: "" });
  const key =
    publicId + ":" + (photo?.id || "") + ":" + (pending ? "staged" : "saved");
  useEffect(() => {
    let alive = true,
      url: string | undefined;
    setLoaded({ key });
    const load = async () => {
      if (!pending && !photo) return;
      try {
        const bytes = pending
          ? pending.web
          : new Blob(
              [
                new Uint8Array(
                  await (publicRead
                    ? readPublicPhoto(publicId, photo!, "web")
                    : readPrivatePhoto(publicId, photo!, "web")),
                ),
              ],
              { type: "image/jpeg" },
            );
        if (!alive) return;
        url = URL.createObjectURL(bytes);
        setLoaded({ key, url });
      } catch {
        if (alive)
          setLoaded({
            key,
            error: "The photo could not be loaded. Reconnect and try again.",
          });
      }
    };
    void load();
    return () => {
      alive = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [publicId, photo?.id, pending, publicRead]);
  return loaded.key === key ? loaded : { key };
}
function PublishedCard({
  draft,
  id,
  showSalesCta,
}: {
  draft: Draft;
  id: string;
  showSalesCta: boolean;
}) {
  const photo = usePhotoPreview(id, draft.photo, null, true);
  return (
    <>
      <ContactCard
        draft={draft}
        id={id}
        showSalesCta={showSalesCta}
        photoUrl={photo.url}
        loadVcfPhoto={
          draft.photo
            ? () => readPublicPhoto(id, draft.photo!, "vcf")
            : undefined
        }
      />
      {photo.error && (
        <p className="notice" role="status">
          {photo.error}
        </p>
      )}
    </>
  );
}
export function ContactCard({
  draft,
  id = "preview",
  showSalesCta = true,
  photoUrl,
  loadVcfPhoto,
}: {
  draft: Draft;
  id?: string;
  showSalesCta?: boolean;
  photoUrl?: string;
  loadVcfPhoto?: () => Promise<Uint8Array | undefined>;
}) {
  const contact = normalizeContact(draft.content),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const valid =
    validateDraft(
      {
        content: contact,
        palette: draft.palette,
        mode: draft.mode,
        configRevision: 1,
      },
      defaultConfig,
    ).length === 0;
  const download = async () => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const photo = loadVcfPhoto ? await loadVcfPhoto() : undefined;
      const text = toVcf(contact, id, photo);
      const url = URL.createObjectURL(
        new Blob([text], { type: "text/vcard;charset=utf-8" }),
      );
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = vcfFilename(contact.name);
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };
  return (
    <article
      className={`contact-card ${draft.mode} ${draft.palette}`}
      aria-label="Contact preview"
    >
      {photoUrl ? (
        <img
          className="profile-portrait"
          src={photoUrl}
          alt={
            contact.name ? `${contact.name}'s profile photo` : "Profile photo"
          }
        />
      ) : (
        <div className="avatar" aria-hidden="true">
          {Array.from(contact.name.trim())[0] || "H"}
        </div>
      )}
      <h1>{contact.name || "Your name"}</h1>
      {(contact.title || contact.company) && (
        <p className="role">
          {[contact.title, contact.company].filter(Boolean).join(" · ")}
        </p>
      )}
      {contact.bio && <p className="bio">{contact.bio}</p>}
      <button
        className="primary"
        onClick={() => void download()}
        disabled={!valid || busy}
      >
        {busy ? "Preparing contact…" : "Save contact"}
        <span aria-hidden="true">↓</span>
      </button>
      {error && (
        <p className="notice" role="alert">
          {error}
        </p>
      )}
      {showSalesCta && (
        <a className="own-cuff" href="/">
          Get Your HelloCuff
        </a>
      )}
      <div className="contact-actions">
        {contact.phone && safePhone(contact.phone) && (
          <a href={`tel:${contact.phone.replace(/[^+0-9]/g, "")}`}>
            <span>Call</span>
            {formatUsPhone(contact.phone)}
          </a>
        )}
        {contact.publicEmail && safeEmail(contact.publicEmail) && (
          <a
            href={`mailto:${encodeURIComponent(contact.publicEmail).replace(/%40/g, "@")}`}
          >
            <span>Email</span>
            {contact.publicEmail}
          </a>
        )}
        {contact.website && safeWebsite(contact.website) && (
          <a href={contact.website} target="_blank" rel="noopener noreferrer">
            <span>Website</span>
            {contact.website.replace(/^https:\/\//, "")}
          </a>
        )}
      </div>
      <p className="card-footer">Wear it. Tap it. Say hello.</p>
    </article>
  );
}
// A pending read is not an unavailable contact or a ready account. Keep this
// surface noninteractive until the server confirms the actual content.
export function LoadingState({ kind }: { kind: "contact" | "account" }) {
  return (
    <main
      className={kind === "contact" ? "public-shell" : "auth-shell"}
      aria-busy="true"
    >
      <section
        className={
          kind === "contact"
            ? "contact-loading-skeleton"
            : "account-loading-skeleton"
        }
        aria-hidden="true"
      >
        <span className="loading-shape loading-avatar" />
        <span className="loading-shape loading-title" />
        <span className="loading-shape loading-line" />
        <span className="loading-shape loading-line" />
      </section>
      <p className="loading-status" role="status">
        {kind === "contact" ? "Loading contact." : "Loading your account."}
      </p>
    </main>
  );
}
export function PublicPage({ id, owner }: { id: string; owner: OwnerModel }) {
  const [record, setRecord] = useState<{
    id: string;
    draft: Draft | null;
    status: string;
  }>({ id, draft: null, status: "loading" });
  const state =
    record.id === id ? record : { id, draft: null, status: "loading" };
  useEffect(() => {
    let alive = true,
      latest = 0;
    setRecord({ id, draft: null, status: "loading" });
    const load = () => {
      const request = ++latest;
      if (!/^[a-f0-9]{32}$/.test(id)) {
        setRecord({ id, draft: null, status: "unavailable" });
        return;
      }
      void api
        .readPublic(id)
        .then((snapshot) => {
          if (!alive || latest !== request) return;
          setRecord(
            snapshot.exists() && snapshot.data().published
              ? { id, draft: snapshot.data() as Draft, status: "ready" }
              : { id, draft: null, status: "unavailable" },
          );
        })
        .catch(() => {
          if (alive && latest === request)
            setRecord({
              id,
              draft: null,
              status: navigator.onLine ? "unavailable" : "offline",
            });
        });
    };
    load();
    const timer = setInterval(load, 30000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [id]);
  const actualOwner =
    !!owner.user &&
    owner.uid === owner.user.uid &&
    owner.data?.account.publicId === id;
  if (state.status === "loading") return <LoadingState kind="contact" />;
  return (
    <main className="public-shell">
      {state.status === "ready" && state.draft ? (
        <>
          <PublishedCard
            draft={state.draft}
            id={id}
            showSalesCta={!owner.user}
          />
          {actualOwner && (
            <div className="public-account-action">
              <AppLink to="/app/profile">Edit my card</AppLink>
            </div>
          )}
        </>
      ) : (
        <section className="panel unavailable-panel">
          <h1>
            {state.status === "offline"
              ? "You are offline"
              : "Contact unavailable"}
          </h1>
          <p>
            {state.status === "offline"
              ? "Reconnect and refresh to view this contact."
              : "This contact is not available right now."}
          </p>
          {!owner.user && (
            <a href="/" className="link-button">
              Get Your HelloCuff
            </a>
          )}
          <a href="/">HelloCuff home</a>
          {actualOwner && <AppLink to="/app/profile">Edit my card</AppLink>}
        </section>
      )}
    </main>
  );
}
export function Profile({ owner }: { owner: OwnerModel }) {
  const {
    user,
    data,
    draft,
    config,
    entitlement,
    busy,
    pendingPhoto,
    uploadedPhoto,
  } = owner;
  const [touched, setTouched] = useState<Partial<Record<Field, boolean>>>({});
  const photo = usePhotoPreview(
    data?.account.publicId || "",
    draft.photo,
    pendingPhoto,
    false,
  );
  if ((!data || !user) && !owner.loadError)
    return <LoadingState kind="account" />;
  if (!data || !user)
    return (
      <main className="auth-shell">
        <section className="panel">
          <h1>
            {owner.loadError
              ? "Could not open your account"
              : "Opening your account."}
          </h1>
          <p role="status" className="notice">
            {owner.notice}
          </p>
          {owner.loadError && (
            <button onClick={() => void owner.load()}>
              Retry loading account
            </button>
          )}
        </section>
      </main>
    );
  const currentConfig = config?.planId === entitlement.plan ? config : null,
    plan = currentConfig?.plan;
  const verified = owner.verification?.verifiedForPublish === true;
  const normalized = { ...draft, content: normalizeContact(draft.content) };
  const errors =
    currentConfig && entitlement.plan
      ? validateDraftFields(normalized, currentConfig, entitlement.plan)
      : {};
  const updateDraft = (next: Draft) =>
    owner.update({ draft: next, dirty: true });
  const save = async (publish: boolean) => {
    if (!currentConfig || !entitlement.plan)
      throw Error("Plan configuration is unavailable.");
    setTouched(Object.fromEntries(fields.map((field) => [field, true])));
    // A newly cropped replacement must be able to supersede a saved photo that
    // no longer meets tightened limits. This copy never mutates the old draft.
    const beforeUpload = { ...normalized };
    if (pendingPhoto) delete beforeUpload.photo;
    const validation = validateDraft(
      beforeUpload,
      currentConfig,
      entitlement.plan,
    );
    if (validation.length) {
      const photoError = validateDraftFields(
        beforeUpload,
        currentConfig,
        entitlement.plan,
      ).photo;
      throw Error(
        validation.join(" ") +
          (photoError
            ? " Replace or remove the photo before saving. Your saved draft and public card are unchanged."
            : ""),
      );
    }
    let candidate = normalized;
    if (pendingPhoto) {
      if (!photoStorageReady)
        throw Error(
          "Photo storage is not available in this environment yet. Your photo and edits are retained here.",
        );
      const uploaded =
        uploadedPhoto ||
        (await uploadPhoto(
          data.account.publicId,
          pendingPhoto,
          photoPolicy(currentConfig),
        ));
      owner.update({ uploadedPhoto: uploaded });
      candidate = { ...normalized, photo: uploaded };
    }
    const finalValidation = validateDraft(
      candidate,
      currentConfig,
      entitlement.plan,
    );
    if (finalValidation.length) throw Error(finalValidation.join(" "));
    await api.saveDraft(
      user,
      candidate,
      currentConfig,
      entitlement.plan,
      publish,
      data.account.publicId,
    );
    owner.update((previous) => ({
      draft: { ...candidate, configRevision: currentConfig.revision },
      dirty: false,
      pendingPhoto: null,
      uploadedPhoto: null,
      data: previous.data
        ? {
            ...previous.data,
            draft: candidate,
            published: publish || previous.data.published,
          }
        : null,
      notice: publish
        ? "Published. Your page and contact download now use these details."
        : "Draft saved.",
    }));
    if (photoStorageReady)
      void cleanupPhotos(data.account.publicId).catch(() =>
        console.warn("Photo cleanup will retry in a later session."),
      );
  };
  const changeField = (field: Field, value: string) => {
    if (value !== draft.content[field])
      updateDraft({ ...draft, content: { ...draft.content, [field]: value } });
  };
  const finishField = (field: Field) => {
    setTouched((previous) => ({ ...previous, [field]: true }));
    changeField(field, normalizeField(field, draft.content[field]));
  };
  return (
    <main className="dashboard" data-load-ms={owner.loadMs ?? undefined}>
      <section className="workspace">
        <div className="workspace-heading">
          <div>
            <p className="eyebrow">
              {entitlement.plan || "Plan unavailable"} ·{" "}
              {plan?.profileLimit ?? "—"} contact profile
            </p>
            <h1>
              Your hello,
              <br />
              your way.
            </h1>
          </div>
          <span className={`pill ${data.published ? "live" : "unpublished"}`}>
            {data.published ? "Published" : "Unpublished"}
          </span>
        </div>
        {!data.published && (
          <p className="unpublished-banner" role="status">
            <strong>Your card is unpublished.</strong> Save your details and
            publish when you are ready to share it.
          </p>
        )}
        <section className="verification">
          <strong>
            {verified ? "Email verified" : "Verify before publishing"}
          </strong>
          <span>{user.email}</span>
          {!verified && (
            <div className="button-row">
              <button
                disabled={busy}
                onClick={() =>
                  void owner.run(async () => {
                    await api.verifyEmail(user);
                    owner.update({
                      notice: api.emulator
                        ? "Verification sent to the local Auth emulator inbox. No real email was sent."
                        : "Verification email sent.",
                    });
                  })
                }
              >
                Send verification email
              </button>
              <button
                disabled={busy}
                onClick={() =>
                  void owner.run(async () => {
                    const status = await owner.refreshVerification();
                    owner.update({
                      notice: status.verifiedForPublish
                        ? "Email verified. You can publish."
                        : "Email is not verified yet. Open the verification link first.",
                    });
                  })
                }
              >
                Refresh verification
              </button>
            </div>
          )}
        </section>
        {entitlement.error && (
          <p className="notice" role="alert">
            {entitlement.error}
          </p>
        )}
        {!entitlement.plan && !entitlement.error && (
          <p className="hint">Checking your assigned plan.</p>
        )}
        {entitlement.plan && !currentConfig && (
          <p className="notice" role="alert">
            Plan configuration is missing or invalid. Save and publish are
            paused; saved data is retained. Unpublish and removal remain
            available.
          </p>
        )}
        <form
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            void owner.run(() => save(false));
          }}
        >
          <fieldset disabled={busy}>
            <legend>Public details</legend>
            <p className="hint">
              Leave optional fields blank to remove them. Your account email is
              never added automatically.
            </p>
            <div className="field-grid">
              {fields.map((field) => (
                <label key={field} className={field === "bio" ? "full" : ""}>
                  <span className="field-label">
                    {labels[field]}
                    {field !== "name" && <small>optional</small>}
                  </span>
                  {field === "bio" ? (
                    <textarea
                      aria-label="Short bio optional"
                      name={field}
                      rows={4}
                      value={draft.content[field]}
                      aria-describedby={`limit-${field} error-${field}`}
                      aria-invalid={!!touched[field] && !!errors[field]}
                      onChange={(event) =>
                        changeField(field, event.target.value)
                      }
                      onBlur={() => finishField(field)}
                    />
                  ) : (
                    <input
                      aria-label={`${labels[field]}${field === "name" ? "" : " optional"}`}
                      name={field}
                      type={
                        field === "publicEmail"
                          ? "email"
                          : field === "phone"
                            ? "tel"
                            : "text"
                      }
                      inputMode={
                        field === "phone"
                          ? "tel"
                          : field === "website"
                            ? "url"
                            : undefined
                      }
                      autoComplete={
                        field === "phone"
                          ? "tel-national"
                          : field === "website"
                            ? "url"
                            : undefined
                      }
                      required={field === "name"}
                      value={
                        field === "phone"
                          ? formatUsPhone(draft.content[field])
                          : draft.content[field]
                      }
                      aria-describedby={`limit-${field} error-${field}`}
                      aria-invalid={!!touched[field] && !!errors[field]}
                      placeholder={
                        field === "website"
                          ? "example.com"
                          : field === "phone"
                            ? "(555) 123-4567"
                            : undefined
                      }
                      onChange={(event) =>
                        changeField(field, event.target.value)
                      }
                      onBlur={() => finishField(field)}
                    />
                  )}
                  <small id={`limit-${field}`}>
                    {draft.content[field].length} / {plan?.limits[field] ?? "—"}
                  </small>
                  <small id={`error-${field}`} className="field-error">
                    {touched[field] ? errors[field] || "" : ""}
                  </small>
                </label>
              ))}
            </div>
            <div className="field-grid">
              <label>
                Preset color
                <select
                  value={draft.palette}
                  onChange={(event) =>
                    updateDraft({
                      ...draft,
                      palette: event.target.value as Draft["palette"],
                    })
                  }
                >
                  {palettes.map((value) => (
                    <option
                      key={value}
                      disabled={!!plan && !plan.palettes.includes(value)}
                    >
                      {value}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Appearance
                <select
                  value={draft.mode}
                  onChange={(event) =>
                    updateDraft({
                      ...draft,
                      mode: event.target.value as Draft["mode"],
                    })
                  }
                >
                  {modes.map((value) => (
                    <option
                      key={value}
                      disabled={!!plan && !plan.modes.includes(value)}
                    >
                      {value}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {currentConfig && (
              <section className="photo-section">
                <h2>Profile photo</h2>
                <PhotoEditor
                  policy={photoPolicy(currentConfig)}
                  value={photo.url}
                  disabled={busy}
                  onProcessed={(result) =>
                    owner.update({
                      pendingPhoto: result,
                      uploadedPhoto: null,
                      dirty: true,
                    })
                  }
                  onRemove={() => {
                    owner.update({ pendingPhoto: null, uploadedPhoto: null });
                    const next = { ...draft };
                    delete next.photo;
                    updateDraft(next);
                  }}
                />
                {photo.error && (
                  <p className="notice" role="status">
                    {photo.error}
                  </p>
                )}
              </section>
            )}
            <div className="button-row">
              <button type="submit" disabled={!currentConfig || busy}>
                Save draft
              </button>
              <button
                type="button"
                className="primary"
                disabled={!currentConfig || !verified || busy}
                onClick={() => void owner.run(() => save(true))}
              >
                Publish changes
              </button>
            </div>
          </fieldset>
        </form>
        <p className="notice" role="status" aria-live="polite">
          {busy ? "Saving." : owner.notice}
        </p>
        <section className="stable-link">
          <strong>Your permanent contact link</strong>
          <a
            href={`/p/${data.account.publicId}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            {location.origin}/p/{data.account.publicId}
          </a>
          <p className="hint">
            Editing your details will not change this link.
          </p>
        </section>
        <div className="button-row secondary-actions">
          <button
            disabled={busy}
            onClick={() =>
              void owner.run(async () => {
                await api.unpublish(data.account.publicId);
                owner.update((previous) => ({
                  data: previous.data
                    ? { ...previous.data, published: false }
                    : null,
                  notice: "Unpublished. Your private draft is retained.",
                }));
                if (photoStorageReady)
                  void cleanupPhotos(data.account.publicId).catch(() =>
                    console.warn(
                      "Photo cleanup will retry in a later session.",
                    ),
                  );
              })
            }
          >
            Unpublish
          </button>
          <button
            disabled={busy}
            onClick={() => {
              if (
                confirm(
                  "Remove all profile details from your private draft and public page? Your stable link stays reserved.",
                )
              )
                void owner.run(async () => {
                  await api.clearProfile(user, data.account.publicId);
                  owner.update((previous) => ({
                    draft: emptyDraft(),
                    pendingPhoto: null,
                    uploadedPhoto: null,
                    dirty: false,
                    data: previous.data
                      ? { ...previous.data, published: false, draft: null }
                      : null,
                    notice:
                      "Profile details removed. Your stable link stays reserved.",
                  }));
                  if (photoStorageReady)
                    void cleanupPhotos(data.account.publicId).catch(() =>
                      console.warn(
                        "Photo cleanup will retry in a later session.",
                      ),
                    );
                });
            }}
          >
            Remove profile data
          </button>
        </div>
      </section>
      <aside className="preview">
        <p className="preview-label">Card preview</p>
        <ContactCard
          draft={normalized}
          id={data.account.publicId}
          showSalesCta={false}
          photoUrl={photo.url}
          loadVcfPhoto={
            pendingPhoto
              ? async () => new Uint8Array(await pendingPhoto.vcf.arrayBuffer())
              : draft.photo
                ? () =>
                    readPrivatePhoto(data.account.publicId, draft.photo!, "vcf")
                : undefined
          }
        />
      </aside>
    </main>
  );
}
