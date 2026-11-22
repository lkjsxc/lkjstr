use lkjstr_core::{
    engine::avatars::{MAX_URL_BYTES, jobs::*},
    store::Profile,
};

fn owner(request: &str) -> Owner {
    Owner {
        client: 1,
        request: request.into(),
    }
}
fn fallback(book: &mut Book, picture: &str) {
    let who = owner("inline");
    let commands = book.want(who.clone(), picture, 0);
    assert_eq!(
        commands,
        vec![Command::Reply {
            owner: who.clone(),
            job: None,
            result: ResultKind::Fallback { uniform: false },
        }]
    );
    assert!(book.pump(0).is_empty());
    assert!(book.release(&who).is_empty());
    assert!(book.detach(1).is_empty());
    assert_eq!(book.counts(), Book::default().counts());
}

#[test]
fn accepted_inline_profile_images_keep_the_original_route_without_worker_jobs() {
    let mut book = Book::default();
    for picture in [
        "data:image/png;base64,iVBORw0KGgo=",
        "data:image/jpeg;base64,/9j/",
        "data:image/webp;base64,UklGRg==",
        "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='36' height='36'%3E%3Crect width='36' height='36' fill='purple'/%3E%3C/svg%3E",
    ] {
        let profile = Profile::parse(&serde_json::json!({ "picture": picture }).to_string());
        assert_eq!(
            profile.picture, picture,
            "the existing metadata contract accepts this image"
        );
        fallback(&mut book, &profile.picture);
    }
}

#[test]
fn inline_fallback_does_not_admit_other_schemes_or_bypass_message_bounds() {
    let mut book = Book::default();
    for picture in [
        "javascript:alert(1)".to_owned(),
        "http://avatar.invalid/one.png".into(),
        "data:text/html,<svg/>".into(),
        "data:image/gif;base64,R0lGODlh".into(),
        "blob:https://avatar.test/local".into(),
        format!("data:image/png;base64,{}", "a".repeat(MAX_URL_BYTES)),
    ] {
        assert_eq!(
            book.want(owner("invalid"), &picture, 0),
            vec![Command::Reply {
                owner: owner("invalid"),
                job: None,
                result: ResultKind::Rejected,
            }]
        );
    }
    for request in ["".to_owned(), "a".repeat(MAX_REQUEST_BYTES + 1)] {
        let who = owner(&request);
        assert_eq!(
            book.want(who.clone(), "data:image/png;base64,iVBORw0KGgo=", 0),
            vec![Command::Reply {
                owner: who,
                job: None,
                result: ResultKind::Rejected
            }]
        );
    }
    assert!(book.pump(0).is_empty());
    assert_eq!(book.counts(), Book::default().counts());
}

#[test]
fn inline_classification_cannot_replace_an_active_request_for_another_url() {
    let mut book = Book::default();
    let who = owner("existing");
    assert!(
        book.want(who.clone(), "https://avatar.test/face", 0)
            .is_empty()
    );
    let before = book.counts();
    assert_eq!(
        book.want(who.clone(), "data:image/png;base64,iVBORw0KGgo=", 1),
        vec![Command::Reply {
            owner: who.clone(),
            job: None,
            result: ResultKind::Rejected
        }]
    );
    assert_eq!(book.counts(), before);
    assert_eq!(book.release(&who).len(), 1);
    assert!(book.pump(1).is_empty());
    assert_eq!(book.counts(), Book::default().counts());
}
