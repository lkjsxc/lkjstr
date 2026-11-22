use super::*;
pub(super) fn apply(h: &mut Host, commands: Vec<Command>) -> Vec<Work> {
    let mut work = Vec::new();
    for command in commands {
        match command {
            Command::Run(next) => work.push(next),
            Command::Abort(ticket) => {
                if let Some((stage, controller)) = h.avatars.effects.get(&ticket.job)
                    && *stage == ticket.stage
                {
                    controller.abort();
                }
            }
            Command::Release(id) => {
                h.avatars.raw.remove(&id);
                h.avatars.pictures.remove(&id);
            }
            Command::Reply {
                owner,
                job,
                mut result,
            } => {
                if h.stopped || !h.sessions.contains_key(&owner.client) {
                    continue;
                }
                let picture = job
                    .and_then(|id| h.avatars.pictures.get(&id))
                    .filter(|_| matches!(result, ResultKind::Ready { .. }));
                if matches!(result, ResultKind::Ready { .. }) && picture.is_none() {
                    result = ResultKind::Rejected;
                }
                let image = picture.map(|picture| ImageInfo {
                    edge: picture.edge,
                    source_width: picture.source_width,
                    source_height: picture.source_height,
                    bytes: picture.blob.size() as u64,
                    mime: picture.blob.type_(),
                });
                let envelope = Envelope {
                    t: "avatar",
                    req: &owner.request,
                    result,
                    image,
                };
                h.scope.avatar(
                    owner.client,
                    &envelope,
                    picture.map(|picture| &picture.blob),
                );
            }
        }
    }
    work
}
