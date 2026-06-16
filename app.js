/*
  Ballyheigue Summer Festival app

  The HTML stays reusable because all event and venue content comes from:
  - data/events.js
  - data/locations.js
*/
(function () {
  const events = window.festivalEvents || [];
  const locations = normalizeLocations(window.festivalLocations || []);
  const mapFeatures = normalizeLocations(window.festivalMapFeatures || []);
  const categories = window.festivalCategories || [];

  const ACTIVE_YEAR = 2026;
  const MAP_STYLE_URL = "https://tiles.openfreemap.org/styles/positron";
  const locationById = new Map(locations.map((location) => [location.id, location]));

  const state = {
    year: ACTIVE_YEAR,
    filters: {
      search: "",
      day: "all",
      category: "all",
      location: "all",
      price: "all",
      family: false,
      now: false
    },
    map: null,
    markers: new Map(),
    featureMarkers: new Map(),
    activeMapPopup: null,
    selectedLocationId: null,
    locationDirectoryFilter: "all",
    activeTab: "schedule",
    modalMap: null,
    outsideVillageLocations: [],
    mapOutsideMode: "hint"
  };

  const els = {
    festivalDates: document.querySelector("#festivalDates"),
    searchInput: document.querySelector("#searchInput"),
    searchToggle: document.querySelector("#searchToggle"),
    searchPanel: document.querySelector("#siteSearch"),
    searchClose: document.querySelector("#searchClose"),
    dayFilter: document.querySelector("#dayFilter"),
    categoryFilter: document.querySelector("#categoryFilter"),
    locationFilter: document.querySelector("#locationFilter"),
    priceFilter: document.querySelector("#priceFilter"),
    familyFilter: document.querySelector("#familyFilter"),
    clearFilters: document.querySelector("#clearFilters"),
    clearSearchFilters: document.querySelector("#clearSearchFilters"),
    hero: document.querySelector("#home"),
    brand: document.querySelector(".brand"),
    resultCount: document.querySelector("#resultCount"),
    scheduleList: document.querySelector("#scheduleList"),
    mapPanel: document.querySelector("#mapPanel"),
    mapShell: document.querySelector(".map-shell"),
    mapKey: document.querySelector("#mapKey"),
    mapKeyToggle: document.querySelector("#mapKeyToggle"),
    locationsGrid: document.querySelector("#locationsGrid"),
    eventModal: document.querySelector("#eventModal"),
    eventModalMap: document.querySelector("#eventModalMap"),
    eventModalContent: document.querySelector("#eventModalContent"),
    tabButtons: [...document.querySelectorAll("[data-tab-target]")],
    tabPanels: [...document.querySelectorAll("[data-tab-panel]")],
    quickFilterList: document.querySelector(".quick-filter-list"),
    explorerLocationFilters: document.querySelector(".explorer-location-filters"),
    mapOutsideHint: document.querySelector("#mapOutsideHint"),
    quickFilters: [...document.querySelectorAll("[data-quick-filter]")],
    locationFilters: [...document.querySelectorAll("[data-location-directory-filter]")]
  };

  function normalizeLocations(rawLocations) {
    return rawLocations.flat().map((location) => ({
      ...location,
      lat: Number(location?.lat),
      lng: Number(location?.lng)
    }));
  }

  function hasValidCoordinates(location) {
    return Number.isFinite(location?.lat) && Number.isFinite(location?.lng);
  }

  function init() {
    if (!events.length || !locations.length) {
      document.body.innerHTML = "<main class='section'><h1>Festival data missing</h1><p>Check data/events.js and data/locations.js.</p></main>";
      return;
    }

    renderFilterOptions();
    bindEvents();
    renderMapKeyIcons();
    renderAll();
    els.mapPanel.innerHTML = defaultMapPanelHtml();
    initMap();
    setTimeout(alignInitialHash, 120);
  }

  function bindEvents() {
    els.searchInput.addEventListener("input", (event) => {
      state.filters.search = event.target.value.trim().toLowerCase();
      setActiveTab("schedule", { scroll: true });
      updateFilterClearState();
      renderSchedule();
    });

    els.searchToggle.addEventListener("click", () => {
      toggleSearch(els.searchPanel.hidden);
    });

    els.searchClose.addEventListener("click", () => {
      toggleSearch(false);
    });

    els.mapKeyToggle?.addEventListener("click", (event) => {
      event.stopPropagation();
      toggleMapKey(!els.mapKey?.classList.contains("is-open"));
    });

    els.dayFilter.addEventListener("change", updateSelectFilter("day"));
    els.categoryFilter.addEventListener("change", updateSelectFilter("category"));
    els.locationFilter.addEventListener("change", updateSelectFilter("location"));
    els.priceFilter.addEventListener("change", updateSelectFilter("price"));
    els.familyFilter.addEventListener("change", (event) => {
      state.filters.family = event.target.checked;
      updateQuickFilterState(inferQuickFilterState());
      updateFilterClearState();
      renderSchedule();
    });
    els.clearFilters.addEventListener("click", () => resetFilters(true));
    els.clearSearchFilters?.addEventListener("click", () => {
      els.clearSearchFilters.hidden = true;
      resetFilters(true);
    });

    document.addEventListener("click", (event) => {
      if (!els.searchPanel.hidden
        && !els.searchPanel.contains(event.target)
        && !els.searchToggle.contains(event.target)) {
        toggleSearch(false);
      }

      if (els.mapKey?.classList.contains("is-open")
        && !els.mapKey.contains(event.target)
        && !els.mapKeyToggle?.contains(event.target)) {
        toggleMapKey(false);
      }

      const target = event.target.closest("[data-action], [data-tab-target]");
      if (!target) return;

      const eventId = target.dataset.eventId;
      const locationId = target.dataset.locationId;

      if (target.dataset.tabTarget) {
        event.preventDefault();
        dismissHero();
        setActiveTab(target.dataset.tabTarget, { scroll: true });
      }

      if (target.dataset.action === "show-map") {
        if (!els.eventModal.hidden) {
          closeEventModal();
        }
        if (eventId) {
          focusEventLocations(eventId, { scroll: true });
        } else {
          focusLocation(locationId, { openPanel: true, scroll: true });
        }
      }

      if (target.dataset.action === "filter-location") {
        filterByLocation(locationId);
      }

      if (target.dataset.action === "schedule-location") {
        showScheduleForLocation(locationId);
      }

      if (target.dataset.action === "schedule-event") {
        showEventInSchedule(eventId);
      }

      if (target.dataset.action === "toggle-place") {
        openPlaceModal(target.dataset.placeKey);
      }

      if (target.dataset.action === "focus-feature") {
        if (!els.eventModal.hidden) {
          closeEventModal();
        }
        focusFeature(target.dataset.featureId);
      }

      if (target.dataset.action === "calendar") {
        downloadCalendarEvent(eventId);
      }

      if (target.dataset.action === "copy-link") {
        copyEventLink(eventId, target);
      }

      if (target.dataset.action === "share") {
        shareEvent(eventId);
      }

      if (target.dataset.action === "toggle-event") {
        openEventModal(eventId);
      }

      if (target.dataset.action === "toggle-day") {
        toggleDayGroup(target.dataset.date);
      }

      if (target.dataset.action === "event-focus") {
        openEventModal(eventId);
      }

      if (target.dataset.action === "close-event-modal") {
        closeEventModal();
      }
    });

    els.brand.addEventListener("click", () => {
      showHero();
    });

    els.quickFilters.forEach((button) => {
      button.addEventListener("click", () => applyQuickFilter(button.dataset.quickFilter));
    });

    els.locationFilters.forEach((button) => {
      button.addEventListener("click", () => applyLocationDirectoryFilter(button.dataset.locationDirectoryFilter));
    });

    els.mapOutsideHint?.addEventListener("click", focusOutsideVillageLocations);

    window.addEventListener("hashchange", focusEventFromHash);
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !els.searchPanel.hidden) {
        toggleSearch(false);
      }
      if (event.key === "Escape" && !els.eventModal.hidden) {
        closeEventModal();
      }
    });
  }

  function toggleSearch(open) {
    els.searchPanel.hidden = !open;
    els.searchToggle.setAttribute("aria-expanded", String(open));
    els.searchToggle.setAttribute("aria-label", open ? "Close search" : "Open search");

    if (open) {
      setActiveTab("schedule");
      setTimeout(() => els.searchInput.focus(), 40);
    }
  }

  function toggleMapKey(open) {
    if (!els.mapKey || !els.mapKeyToggle) return;
    els.mapKey.classList.toggle("is-open", open);
    els.mapKeyToggle.setAttribute("aria-expanded", String(open));
  }

  function setActiveTab(tabName, options = {}) {
    if (!tabName) return;
    state.activeTab = tabName;

    els.tabButtons.forEach((button) => {
      const isActive = button.dataset.tabTarget === tabName;
      button.classList.toggle("is-active", isActive);
      if (button.getAttribute("role") === "tab") {
        button.setAttribute("aria-selected", String(isActive));
      }
    });

    els.tabPanels.forEach((panel) => {
      panel.hidden = panel.dataset.tabPanel !== tabName;
    });

    if (els.quickFilterList) {
      els.quickFilterList.hidden = tabName !== "schedule";
    }
    if (els.explorerLocationFilters) {
      els.explorerLocationFilters.hidden = !["map", "locations"].includes(tabName);
    }

    if (tabName === "map" && state.map) {
      setTimeout(() => {
        state.map.resize();
      }, 60);
    }

    if (options.scroll) {
      scrollTabContentIntoView(tabName);
    }
  }

  function scrollTabContentIntoView(tabName) {
    const scrollTarget = tabName === "schedule"
      ? document.querySelector("#schedule")
      : tabName === "map"
        ? document.querySelector("#map-section")
        : tabName === "locations"
          ? document.querySelector("#locations")
          : document.querySelector("#explorer");
    if (!scrollTarget) return;

    const stickyOffset = window.matchMedia("(max-width: 520px)").matches
      ? 12.4 * parseFloat(getComputedStyle(document.documentElement).fontSize)
      : 8 * parseFloat(getComputedStyle(document.documentElement).fontSize);
    const top = scrollTarget.getBoundingClientRect().top + window.scrollY - stickyOffset;
    window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
  }

  function dismissHero() {
    els.hero?.classList.add("is-dismissed");
  }

  function showHero() {
    els.hero?.classList.remove("is-dismissed");
  }

  function updateSelectFilter(name) {
    return (event) => {
      state.filters[name] = event.target.value;
      updateQuickFilterState(inferQuickFilterState());
      updateFilterClearState();
      renderSchedule();
    };
  }

  function renderAll() {
    renderHome();
    renderSchedule();
    renderLocations();
    focusEventFromHash();
  }

  function currentYearEvents() {
    return events
      .filter((event) => event.year === state.year)
      .sort((a, b) => eventStart(a) - eventStart(b));
  }

  function renderFilterOptions() {
    const yearEvents = currentYearEvents();
    const days = [...new Map(yearEvents.map((event) => [event.date, event])).values()];
    const usedLocations = locations.filter((location) => yearEvents.some((event) => event.locationId === location.id));

    els.dayFilter.innerHTML = [
      `<option value="all">All days</option>`,
      ...days.map((event) => `<option value="${event.date}">${event.dayLabel}, ${formatDate(event.date)}</option>`)
    ].join("");

    els.categoryFilter.innerHTML = [
      `<option value="all">All event types</option>`,
      ...categoryFilterOptions(yearEvents).map((category) => `<option value="${category}">${categoryLabel(category)}</option>`)
    ].join("");

    els.locationFilter.innerHTML = [
      `<option value="all">All locations</option>`,
      ...usedLocations.map((location) => `<option value="${location.id}">${location.name}</option>`)
    ].join("");

    syncFilterInputs();
  }

  function renderHome() {
    const yearEvents = currentYearEvents();
    const start = yearEvents[0]?.date;
    const end = yearEvents[yearEvents.length - 1]?.date;
    els.festivalDates.textContent = start && end
      ? `${formatDate(start)} to ${formatDate(end)}`
      : "Dates to be announced";
  }

  function renderNow() {
    const now = new Date();
    const yearEvents = currentYearEvents();
    const happening = yearEvents.filter((event) => eventStart(event) <= now && eventEnd(event) >= now);
    const soon = yearEvents.filter((event) => {
      const startsInMinutes = (eventStart(event) - now) / 60000;
      return startsInMinutes > 0 && startsInMinutes <= 120;
    });
    const today = yearEvents.filter((event) => sameDate(eventStart(event), now) && eventStart(event) > now);
    const nextToday = today[0];

    const cards = [];
    if (happening.length) {
      cards.push(renderNowCard("Happening now", happening));
    }
    if (soon.length) {
      cards.push(renderNowCard("Starting soon", soon));
    }
    if (nextToday) {
      cards.push(renderNowCard("Next today", [nextToday]));
    }

    els.nowGrid.innerHTML = cards.length
      ? cards.join("")
      : `<div class="empty-state">No events happening right now. Check the schedule below.</div>`;
  }

  function renderNowCard(label, cardEvents) {
    return `
      <article class="now-card">
        <strong>${label}</strong>
        ${cardEvents.map((event) => {
          const location = locationById.get(event.locationId);
          return `
            <h3>${event.title}</h3>
            <p>${formatTimeRange(event)} at ${eventLocationName(event)}</p>
            <button class="button" data-action="show-map" data-location-id="${event.locationId}">Show on map</button>
          `;
        }).join("")}
      </article>
    `;
  }

  function renderSchedule() {
    const filtered = getFilteredEvents();
    const scheduleEvents = combineScheduleEvents(filtered);
    updateFilterClearState();
    els.resultCount.textContent = `${scheduleEvents.length} event${scheduleEvents.length === 1 ? "" : "s"} shown`;

    if (!scheduleEvents.length) {
      els.scheduleList.innerHTML = `<div class="empty-state">No events match those filters. Try clearing the filters or choosing another day.</div>`;
      return;
    }

    els.scheduleList.innerHTML = groupBy(scheduleEvents, "date")
      .map(([date, dayEvents]) => renderDayGroup(date, dayEvents))
      .join("");
  }

  function renderDayGroup(date, dayEvents) {
    const first = dayEvents[0];
    const todayLabel = isTodayForSelectedYear(date) ? `<span class="today-pill">Today</span>` : "";
    return `
      <div class="day-group" data-day-group="${date}">
        <div class="day-heading">
          <button class="day-toggle" type="button" data-action="toggle-day" data-date="${date}" aria-expanded="true" aria-controls="day-events-${date}">
            <span>${first.dayLabel}, ${formatDate(date)}</span>
            <span>${dayEvents.length} event${dayEvents.length === 1 ? "" : "s"}</span>
          </button>
          ${todayLabel}
        </div>
        <div class="day-events" id="day-events-${date}">
          ${dayEvents.map(renderEventCard).join("")}
        </div>
      </div>
    `;
  }

  function renderEventCard(event) {
    const priceLabel = event.price && !isFree(event) ? `<span class="event-price">${event.price}</span>` : `<span class="event-price" aria-hidden="true"></span>`;
    return `
      <article class="event-card${event.image ? " has-image" : ""}" id="event-${event.id}">
        ${event.image ? `<img class="event-image" src="${event.image}" alt="">` : ""}
        <div class="event-body">
          <button class="event-summary" type="button" data-action="toggle-event" data-event-id="${event.id}">
            <span class="event-summary-main">
              <strong>${event.startTime}</strong>
              <span>${event.title}</span>
            </span>
            ${priceLabel}
            <span class="event-summary-meta">${event.category} | ${scheduleDisplayLocationName(event)}</span>
          </button>
        </div>
      </article>
    `;
  }

  function renderLocations() {
    const yearEvents = currentYearEvents();
    const places = [
      ...locations.map((location) => ({ ...location, kind: "location", placeKey: `location-${location.id}` })),
      ...mapFeatures.map((feature) => ({ ...feature, kind: "feature", placeKey: `feature-${feature.id}` }))
    ]
      .filter((place) => placeMatchesLocationFilter(place, yearEvents))
      .sort((a, b) => compareLocationDirectoryPlaces(a, b, yearEvents));

    els.locationsGrid.innerHTML = places.map((place) => {
      const placeEvents = place.kind === "location"
        ? yearEvents.filter((event) => event.locationId === place.id)
        : [];
      const count = placeEvents.length;
      const dayCount = new Set(placeEvents.map((event) => event.date)).size;
      const nextEvent = placeEvents[0];
      const nextEventHtml = nextEvent
        ? `<span class="location-next">Next: <strong>${nextEvent.title}</strong><small>${shortDayTime(nextEvent)}</small></span>`
        : `<span class="location-next location-next-empty">Map only</span>`;
      return `
        <article class="location-card compact-location-card" data-place-card="${place.placeKey}">
          <button class="location-summary" type="button" data-action="toggle-place" data-place-key="${place.placeKey}">
            <span>
              <small>${place.type}</small>
              <strong>${place.name}</strong>
              ${nextEventHtml}
            </span>
            <em>${count ? `${count} event${count === 1 ? "" : "s"} · ${dayCount} day${dayCount === 1 ? "" : "s"}` : "Map only"}</em>
          </button>
        </article>
      `;
    }).join("");
  }

  function renderPlaceEvents(placeEvents) {
    if (!placeEvents.length) {
      return `<p class="panel-note">No festival events listed here.</p>`;
    }

    return `
      <div class="location-event-list">
        ${placeEvents.map((event) => `
          <button type="button" data-action="event-focus" data-event-id="${event.id}">
            <span class="place-event-main">
              <strong>${shortDayTime(event)}</strong>
              <span>${event.title}</span>
            </span>
            ${eventPriceBadge(event)}
          </button>
        `).join("")}
      </div>
    `;
  }

  function placeMatchesLocationFilter(place, yearEvents) {
    const eventList = place.kind === "location" ? yearEvents.filter((event) => event.locationId === place.id) : [];

    if (state.locationDirectoryFilter === "bar") return isBarPlace(place);
    if (state.locationDirectoryFilter === "food") return isFoodPlace(place);
    if (state.locationDirectoryFilter === "shop") return isShopPlace(place);
    if (state.locationDirectoryFilter === "events") return eventList.length > 0;
    if (state.locationDirectoryFilter === "parking") return isParkingPlace(place);
    if (state.locationDirectoryFilter === "wc") return isToiletPlace(place);
    return true;
  }

  function compareLocationDirectoryPlaces(a, b, yearEvents) {
    return locationDirectoryRank(a, yearEvents) - locationDirectoryRank(b, yearEvents)
      || String(a.name).localeCompare(String(b.name));
  }

  function locationDirectoryRank(place, yearEvents) {
    const eventCount = place.kind === "location"
      ? yearEvents.filter((event) => event.locationId === place.id).length
      : 0;

    if (isBarPlace(place)) return 10;
    if (eventCount > 0) return 20;
    if (isFoodPlace(place)) return 30;
    if (isShopPlace(place)) return 40;
    if (isParkingPlace(place)) return 50;
    if (isBusPlace(place)) return 60;
    return 70;
  }

  function placeTypeAndIcon(place) {
    return `${place.type || ""} ${place.icon || ""} ${place.name || ""}`.toLowerCase();
  }

  function isBarPlace(place) {
    const type = String(place.type || "").toLowerCase();
    const icon = String(place.icon || "").toLowerCase();
    const name = String(place.name || "").toLowerCase();
    return type === "pub" || type.includes("bar") || icon === "pub" || icon.includes("bar") || name.includes(" bar");
  }

  function isFoodPlace(place) {
    const text = placeTypeAndIcon(place);
    return place.id === "white-sands"
      || ["restaurant", "cafe", "takeaway", "food"].some((value) => text.includes(value));
  }

  function isShopPlace(place) {
    const text = placeTypeAndIcon(place);
    return text.includes("shop") || text.includes("pharmacy");
  }

  function isParkingPlace(place) {
    return placeTypeAndIcon(place).includes("parking");
  }

  function isBusPlace(place) {
    return placeTypeAndIcon(place).includes("bus");
  }

  function isToiletPlace(place) {
    const text = placeTypeAndIcon(place);
    return text.includes("toilet") || text.includes("wc");
  }

  function applyLocationDirectoryFilter(filterName) {
    state.locationDirectoryFilter = filterName || "all";
    updateLocationFilterState();
    updateFilterClearState();
    renderLocations();
    refreshMapMarkers();
  }

  function updateLocationFilterState() {
    els.locationFilters.forEach((button) => {
      button.classList.toggle("is-active", button.dataset.locationDirectoryFilter === state.locationDirectoryFilter);
    });
  }

  function toggleDayGroup(date) {
    const group = document.querySelector(`[data-day-group="${CSS.escape(date)}"]`);
    const toggle = group?.querySelector(".day-toggle");
    if (!group || !toggle) return;

    const isCollapsed = group.classList.toggle("is-collapsed");
    toggle.setAttribute("aria-expanded", String(!isCollapsed));
  }

  function openEventModal(eventId) {
    const event = events.find((item) => item.id === eventId);
    if (!event) return;

    const relatedEvents = relatedEventsForEvent(event);
    const eventLocations = locationsForEvents(relatedEvents);
    els.eventModalContent.innerHTML = `
      <p class="eyebrow">${event.category}</p>
      <h2 id="eventModalTitle">${event.title}</h2>
      <div class="event-detail-summary">
        <div>
          <span>When</span>
          <strong>${event.dayLabel}, ${formatDate(event.date)} | ${formatTimeRange(event)}</strong>
        </div>
        <div>
          <span>Where</span>
          <strong>${modalLocationLabel(relatedEvents)}</strong>
        </div>
        <div>
          <span>Cost</span>
          <strong>${eventCostLabel(event)}</strong>
        </div>
        ${event.hasExplicitEnd ? `
          <div>
            <span>Duration</span>
            <strong>${formatDuration(event)}</strong>
          </div>
        ` : ""}
        ${event.familyFriendly ? `
          <div>
            <span>Family</span>
            <strong>Family friendly</strong>
          </div>
        ` : ""}
      </div>
      <p>${event.description}</p>
      <div class="event-actions event-action-groups">
        <div class="action-group action-group-primary">
          <button class="button primary" type="button" data-action="show-map" data-event-id="${event.id}" data-location-id="${event.locationId}">Show on map</button>
          <button class="button primary" type="button" data-action="calendar" data-event-id="${event.id}">Add to Calendar</button>
        </div>
        <div class="action-group">
          <button class="button" type="button" data-action="share" data-event-id="${event.id}">Share</button>
          <button class="button" type="button" data-action="copy-link" data-event-id="${event.id}">Copy event link</button>
        </div>
      </div>
    `;

    els.eventModal.hidden = false;
    document.body.classList.add("modal-open");
    renderEventModalMap(eventLocations);
  }

  function openPlaceModal(placeKey) {
    const place = getPlaceByKey(placeKey);
    if (!place) return;

    const placeEvents = place.kind === "location"
      ? currentYearEvents().filter((event) => event.locationId === place.id)
      : [];
    const eventDayCount = new Set(placeEvents.map((event) => event.date)).size;

    els.eventModalContent.innerHTML = `
      ${directionsLink(place)}
      <p class="eyebrow">${place.type}</p>
      <h2 id="eventModalTitle">${place.name}</h2>
      <p>${place.description}</p>
      <div class="location-detail-summary">
        <span><strong>Type:</strong> ${place.type}</span>
        <span><strong>Events:</strong> ${placeEvents.length}</span>
        <span><strong>Days:</strong> ${eventDayCount}</span>
        <span><strong>Map:</strong> ${hasValidCoordinates(place) ? "Shown above" : "TBC"}</span>
      </div>
      <div class="location-modal-events">
        <h3>Events here</h3>
        ${renderPlaceEvents(placeEvents)}
      </div>
      <div class="event-actions">
        ${place.kind === "location" ? `<button class="button primary" type="button" data-action="show-map" data-location-id="${place.id}">Show on main map</button>` : `<button class="button primary" type="button" data-action="focus-feature" data-feature-id="${place.id}">Show on main map</button>`}
        ${place.kind === "location" && placeEvents.length ? `<button class="button" type="button" data-action="schedule-location" data-location-id="${place.id}">View in schedule</button>` : ""}
      </div>
    `;

    els.eventModal.hidden = false;
    document.body.classList.add("modal-open");
    renderEventModalMap(place);
  }

  function closeEventModal() {
    els.eventModal.hidden = true;
    document.body.classList.remove("modal-open");
    if (state.modalMap) {
      state.modalMap.remove();
      state.modalMap = null;
    }
  }

  function renderEventModalMap(eventLocations) {
    if (state.modalMap) {
      state.modalMap.remove();
      state.modalMap = null;
    }

    const mapLocations = Array.isArray(eventLocations) ? eventLocations : [eventLocations];
    const validLocations = mapLocations.filter(hasValidCoordinates);
    els.eventModalMap.innerHTML = "";
    if (!window.maplibregl || !validLocations.length) {
      els.eventModalMap.innerHTML = `<div class="map-fallback">Location map unavailable.</div>`;
      return;
    }

    const firstLocation = validLocations[0];
    state.modalMap = new maplibregl.Map({
      container: "eventModalMap",
      style: MAP_STYLE_URL,
      center: [firstLocation.lng, firstLocation.lat],
      zoom: 16.2,
      interactive: false,
      attributionControl: false
    });

    const bounds = new maplibregl.LngLatBounds();
    validLocations.forEach((location) => {
      bounds.extend([location.lng, location.lat]);
      const markerElement = document.createElement("span");
      markerElement.className = `${markerClassName(location, Boolean(location.icon))} modal-map-marker`;
      markerElement.innerHTML = markerIcon(location);
      markerElement.title = location.name;
      new maplibregl.Marker({ element: markerElement, anchor: "center" })
        .setLngLat([location.lng, location.lat])
        .addTo(state.modalMap);
    });

    if (validLocations.length > 1) {
      state.modalMap.fitBounds(bounds, { padding: 56, maxZoom: 16.2, duration: 0 });
    }

    setTimeout(() => state.modalMap?.resize(), 80);
  }

  function getPlaceByKey(placeKey) {
    if (!placeKey) return null;
    if (placeKey.startsWith("location-")) {
      const id = placeKey.replace("location-", "");
      const location = locationById.get(id);
      return location ? { ...location, kind: "location", placeKey } : null;
    }
    if (placeKey.startsWith("feature-")) {
      const id = placeKey.replace("feature-", "");
      const feature = mapFeatures.find((item) => item.id === id);
      return feature ? { ...feature, kind: "feature", placeKey } : null;
    }
    return null;
  }

  function getFilteredEvents() {
    return currentYearEvents().filter((event) => {
      const haystack = `${event.title} ${event.description} ${event.category} ${eventLocationName(event)} ${event.scheduleLocationLabel || ""}`.toLowerCase();
      if (state.filters.search && !haystack.includes(state.filters.search)) return false;
      if (state.filters.day !== "all" && event.date !== state.filters.day) return false;
      if (state.filters.category !== "all" && !eventMatchesCategory(event, state.filters.category)) return false;
      if (state.filters.location !== "all" && event.locationId !== state.filters.location) return false;
      if (state.filters.price === "free" && !isFree(event)) return false;
      if (state.filters.price === "paid" && isFree(event)) return false;
      if (state.filters.family && !event.familyFriendly) return false;
      if (state.filters.now && !eventMatchesNowFilter(event)) return false;
      return true;
    });
  }

  function categoryFilterOptions(yearEvents) {
    const usedCategories = new Set(yearEvents.map((event) => event.category));
    return categories.filter((category) => category === "Nightlife" || usedCategories.has(category));
  }

  function categoryLabel(category) {
    const labels = {
      Community: "Community events",
      Competition: "Competitions",
      Culture: "History & culture",
      Food: "Food events",
      Kids: "Kids events",
      Music: "Music",
      Nightlife: "Evening / Nightlife (after 5pm)",
      Outdoor: "Beach & outdoor",
      Sport: "Sport & fitness",
      Wellness: "Wellness"
    };
    return labels[category] || category;
  }

  function eventMatchesCategory(event, category) {
    if (category === "Nightlife") return isEveningEvent(event);
    if (category === "Sport") return ["Sport", "Fitness"].includes(event.category);
    return event.category === category;
  }

  function isEveningEvent(event) {
    const [hour = "0", minute = "0"] = String(event.startTime || "00:00").split(":");
    return Number(hour) > 17 || (Number(hour) === 17 && Number(minute) >= 0);
  }

  function combineScheduleEvents(scheduleEvents) {
    const grouped = new Map();
    scheduleEvents.forEach((event) => {
      const key = scheduleGroupKey(event);
      grouped.set(key, [...(grouped.get(key) || []), event]);
    });

    return [...grouped.values()].map((group) => {
      if (group.length === 1) return group[0];

      const first = group[0];
      const explicitScheduleLabel = group.find((event) => event.scheduleLocationLabel)?.scheduleLocationLabel;
      const locationLabel = explicitScheduleLabel || uniqueValues(group.map(eventLocationName)).join(", ");
      return {
        ...first,
        relatedEventIds: group.map((event) => event.id),
        combinedLocationLabel: locationLabel,
        locationLabel
      };
    });
  }

  function scheduleGroupKey(event) {
    if (event.scheduleGroupId) return event.scheduleGroupId;
    return [
      event.date,
      event.startTime || "",
      event.timeLabel || "",
      event.hasExplicitEnd ? event.endTime || "" : "",
      event.title.trim().toLowerCase()
    ].join("|");
  }

  function scheduleDisplayLocationName(event) {
    return event.combinedLocationLabel || event.scheduleLocationLabel || eventLocationName(event);
  }

  function relatedEventsForEvent(event) {
    const key = scheduleGroupKey(event);
    return currentYearEvents().filter((item) => scheduleGroupKey(item) === key);
  }

  function locationsForEvents(eventList) {
    const seen = new Set();
    return eventList
      .map((event) => locationById.get(event.locationId))
      .filter((location) => {
        if (!location || seen.has(location.id)) return false;
        seen.add(location.id);
        return true;
      });
  }

  function modalLocationLabel(eventList) {
    return uniqueValues(eventList.map(eventLocationName)).join(", ") || "Location TBC";
  }

  function scheduleCardIdForEvent(eventId) {
    const groupedEvents = combineScheduleEvents(getFilteredEvents());
    const visibleEvent = groupedEvents.find((event) => event.id === eventId || event.relatedEventIds?.includes(eventId));
    return visibleEvent?.id || eventId;
  }

  function uniqueValues(values) {
    return [...new Set(values.filter(Boolean))];
  }

  function initMap() {
    if (!window.maplibregl) {
      els.mapPanel.innerHTML = `<h3>Map unavailable</h3><p>MapLibre could not load. The schedule and location cards still work.</p>`;
      if (els.mapOutsideHint) els.mapOutsideHint.hidden = true;
      return;
    }

    state.map = new maplibregl.Map({
      container: "festivalMap",
      style: MAP_STYLE_URL,
      center: [-9.835, 52.3894],
      zoom: 15.65,
      minZoom: 14.35,
      maxZoom: 18,
      attributionControl: false
    });
    window.festivalMapInstance = state.map;

    state.map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-left");
    state.map.addControl(new maplibregl.AttributionControl({
      compact: true,
      customAttribution: '<a href="https://openmaptiles.org/" target="_blank" rel="noopener noreferrer">&copy; OpenMapTiles</a> <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">&copy; OpenStreetMap contributors</a>'
    }), "bottom-right");
    setTimeout(collapseMapAttribution, 120);

    state.map.on("load", refreshMapMarkers);
    state.map.once("idle", collapseMapAttribution);
    state.map.on("moveend", updateOutsideVillageIndicator);
  }

  function collapseMapAttribution() {
    document
      .querySelectorAll("#festivalMap .maplibregl-ctrl-attrib.maplibregl-compact-show")
      .forEach((control) => control.classList.remove("maplibregl-compact-show"));
  }

  function refreshMapMarkers() {
    if (!state.map || !state.map.loaded()) return;
    registerMapIcons();

    const data = {
      type: "FeatureCollection",
      features: buildMapPointFeatures()
    };

    if (state.map.getSource("festival-points")) {
      state.map.getSource("festival-points").setData(data);
    } else {
      state.map.addSource("festival-points", {
        type: "geojson",
        data
      });

      state.map.addLayer({
        id: "festival-point-active",
        type: "symbol",
        source: "festival-points",
        filter: ["==", ["get", "pointId"], ""],
        layout: {
          "icon-image": ["get", "haloIcon"],
          "icon-allow-overlap": true,
          "icon-ignore-placement": true,
          "icon-anchor": "center",
          "icon-size": ["interpolate", ["linear"], ["zoom"], 11, 0.68, 16, 0.92, 18, 1.08],
          "icon-offset": ["get", "iconOffset"]
        }
      });

      [
        ["festival-point-other", 1],
        ["festival-point-shops", 2],
        ["festival-point-food", 3],
        ["festival-point-event-locations", 4],
        ["festival-point-pubs", 5]
      ].forEach(([id, priority]) => {
        state.map.addLayer({
          id,
          type: "symbol",
          source: "festival-points",
          filter: ["==", ["get", "layerPriority"], priority],
          layout: {
            "icon-image": ["get", "icon"],
            "icon-allow-overlap": true,
            "icon-ignore-placement": true,
            "icon-anchor": "center",
            "icon-size": ["interpolate", ["linear"], ["zoom"], 11, 0.68, 16, 0.92, 18, 1.08],
            "icon-offset": ["get", "iconOffset"],
            "symbol-sort-key": ["get", "sortKey"]
          }
        });
      });

      state.map.moveLayer("festival-point-active");

      state.map.on("click", handleMapCanvasClick);
      state.map.on("mousemove", handleMapCanvasMove);
      state.map.getCanvas().addEventListener("mouseleave", clearMapPointHover);
    }

    updateOutsideVillageIndicator();

    if (state.selectedLocationId) {
      renderMapPanel(state.selectedLocationId);
    }
  }

  function buildMapPointFeatures() {
    const places = [];
    const yearEvents = currentYearEvents();

    locations.forEach((location) => {
      if (!hasValidCoordinates(location)) {
        console.warn("Skipping festival location with invalid coordinates:", location);
        return;
      }
      if (!placeMatchesLocationFilter({ ...location, kind: "location" }, yearEvents)) return;

      places.push({
        place: location,
        options: {
          pointId: `location:${location.id}`,
          locationId: location.id,
          pointType: "location",
          kind: location.id === "white-sands" ? "pub-food" : undefined
        }
      });
    });

    mapFeatures.forEach((feature) => {
      if (!hasValidCoordinates(feature)) {
        console.warn("Skipping map feature with invalid coordinates:", feature);
        return;
      }
      if (!placeMatchesLocationFilter({ ...feature, kind: "feature" }, yearEvents)) return;
      places.push({
        place: feature,
        options: {
          pointId: `feature:${feature.id}`,
          featureId: feature.id,
          pointType: "feature"
        }
      });
    });

    return places.map(({ place, options }) => mapPointFeature(place, options));
  }

  function mapPointFeature(place, options) {
    const kind = options.kind || markerKind(place);
    const layerPriority = markerLayerPriority(place, options.pointType, kind);
    return {
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [options.lng ?? place.lng, options.lat ?? place.lat]
      },
      properties: {
        pointId: options.pointId,
        pointType: options.pointType,
        locationId: options.locationId || "",
        featureId: options.featureId || "",
        name: place.name,
        type: place.type,
        kind,
        icon: `festival-icon-${kind}`,
        haloIcon: `festival-halo-${kind}`,
        sortKey: markerSortKey(kind),
        layerPriority,
        iconOffset: [0, 0]
      }
    };
  }

  function mapPointLayers() {
    return [
      "festival-point-pubs",
      "festival-point-event-locations",
      "festival-point-food",
      "festival-point-shops",
      "festival-point-other"
    ].filter((layerId) => state.map.getLayer(layerId));
  }

  function firstMapPointFeatureAt(point) {
    const features = state.map.queryRenderedFeatures(point, { layers: mapPointLayers() });
    return features
      .sort((a, b) => Number(b.properties?.layerPriority || 0) - Number(a.properties?.layerPriority || 0))[0];
  }

  function handleMapCanvasClick(event) {
    const feature = firstMapPointFeatureAt(event.point);
    if (feature) {
      handleMapPointClick({ features: [feature] });
    }
  }

  function handleMapCanvasMove(event) {
    const feature = firstMapPointFeatureAt(event.point);
    if (!feature) {
      clearMapPointHover();
      return;
    }
    handleMapPointHover({ features: [feature] });
  }

  function handleMapPointClick(event) {
    const feature = event.features?.[0];
    if (!feature) return;
    const properties = feature.properties || {};

    if (properties.locationId) {
      state.selectedLocationId = properties.locationId;
      renderMapPanel(properties.locationId);
      setActiveMapPoint(properties.pointId);
    } else if (properties.featureId) {
      renderFeaturePanel(properties.featureId);
      setActiveMapPoint(properties.pointId);
    }

    showMapPointPopup(feature);
  }

  function handleMapPointHover(event) {
    state.map.getCanvas().style.cursor = "pointer";
    const feature = event.features?.[0];
    if (feature) {
      showMapPointPopup(feature);
    }
  }

  function clearMapPointHover() {
    state.map.getCanvas().style.cursor = "";
    if (state.activeMapPopup) {
      state.activeMapPopup.remove();
      state.activeMapPopup = null;
    }
  }

  function showMapPointPopup(feature) {
    if (state.activeMapPopup) {
      state.activeMapPopup.remove();
    }
    state.activeMapPopup = new maplibregl.Popup({
      closeButton: false,
      closeOnClick: false,
      offset: 18
    })
      .setLngLat(feature.geometry.coordinates)
      .setHTML(`<strong>${feature.properties.name}</strong><br>${feature.properties.type}`)
      .addTo(state.map);
  }

  function setActiveMapPoint(pointId) {
    if (!state.map?.getLayer("festival-point-active")) return;
    state.map.setFilter("festival-point-active", ["==", ["get", "pointId"], pointId || ""]);
  }

  function renderFeaturePanel(featureId) {
    const feature = mapFeatures.find((item) => item.id === featureId);
    if (!feature) return;

    els.mapPanel.innerHTML = `
      ${directionsLink(feature)}
      <h3>${feature.name}</h3>
      <p><strong>${feature.type}</strong></p>
      <p>${feature.description}</p>
    `;
  }

  function defaultMapPanelHtml() {
    const yearEvents = currentYearEvents();
    const venueIds = new Set(yearEvents.map((event) => event.locationId).filter(Boolean));
    const dayCount = new Set(yearEvents.map((event) => event.date)).size;
    return `
      <h3>Explore the festival map</h3>
      <p>Tap a marker to view events, venues, parking, food, toilets and more.</p>
      <div class="map-panel-stats">
        <span><strong>${venueIds.size}</strong> venues</span>
        <span><strong>${yearEvents.length}</strong> events</span>
        <span><strong>${dayCount}</strong> days</span>
      </div>
    `;
  }

  function renderMapPanel(locationId) {
    const location = locationById.get(locationId);
    const locationEvents = currentYearEvents().filter((event) => event.locationId === locationId);
    if (!location) return;

    els.mapPanel.innerHTML = `
      ${directionsLink(location)}
      <h3>${location.name}</h3>
      <p><strong>${location.type}</strong></p>
      <p>${location.description}</p>
      ${locationEvents.length ? `
        <div class="panel-events">
          ${groupBy(locationEvents, "date").map(([date, dayEvents]) => `
            <div class="panel-day">
              <h4>${dayEvents[0].dayLabel}, ${formatDate(date)}</h4>
              ${dayEvents.map((event) => `
                <div class="panel-event">
                  <div class="panel-event-title-row">
                    <button type="button" data-action="event-focus" data-event-id="${event.id}">${event.title}</button>
                    ${eventPriceBadge(event)}
                  </div>
                  <div>${formatTimeRange(event)} | ${event.category}</div>
                </div>
              `).join("")}
            </div>
          `).join("")}
        </div>
      ` : `<p>No events listed here for ${state.year} yet.</p>`}
    `;
  }

  function updateOutsideVillageIndicator() {
    if (!els.mapOutsideHint || !state.map) return;
    const mapCenter = state.map.getCenter();
    const centerPoint = { lat: mapCenter.lat, lng: mapCenter.lng };
    const outsideLocations = relevantMapLocations().filter((location) => !locationIsVisible(location));
    const shouldReturnToMainStreet = mainStreetNeedsReturn();

    state.outsideVillageLocations = outsideLocations;

    els.mapOutsideHint.hidden = false;
    if (shouldReturnToMainStreet) {
      const direction = directionBetweenPlaces(centerPoint, { lat: 52.3894, lng: -9.835 });
      state.mapOutsideMode = "back";
      els.mapOutsideHint.dataset.mode = "back";
      els.mapOutsideHint.dataset.direction = direction;
      els.mapOutsideHint.querySelector("span").textContent = `${arrowForDirection(direction)} Main Street`;
      return;
    }

    if (!outsideLocations.length) {
      els.mapOutsideHint.hidden = true;
      return;
    }

    const primary = averagePlace(outsideLocations);
    const direction = directionBetweenPlaces(centerPoint, primary);
    state.mapOutsideMode = "hint";
    els.mapOutsideHint.dataset.mode = "hint";
    els.mapOutsideHint.dataset.direction = direction;
    els.mapOutsideHint.querySelector("span").textContent = `${arrowForDirection(direction)} ${outsideLocations.length} location${outsideLocations.length === 1 ? "" : "s"}`;
  }

  function focusOutsideVillageLocations() {
    if (!state.map) return;
    if (state.mapOutsideMode === "back") {
      state.selectedLocationId = null;
      state.map.once("moveend", updateOutsideVillageIndicator);
      state.map.flyTo({ center: [-9.835, 52.3894], zoom: 15.65, duration: 500, essential: true });
      setActiveMapPoint("");
      clearMapPointHover();
      els.mapPanel.innerHTML = defaultMapPanelHtml();
      setTimeout(updateOutsideVillageIndicator, 650);
      return;
    }

    if (!state.outsideVillageLocations.length) return;
    const bounds = new maplibregl.LngLatBounds();
    state.outsideVillageLocations.forEach((location) => bounds.extend([location.lng, location.lat]));
    state.selectedLocationId = null;
    clearMapPointHover();
    setActiveMapPoint("");
    state.map.fitBounds(bounds, {
      padding: { top: 72, right: 46, bottom: 46, left: 46 },
      maxZoom: 15.9,
      duration: 500,
      essential: true
    });
    setTimeout(updateOutsideVillageIndicator, 600);
  }

  function isInsideVillageMap(place) {
    return place.lat >= 52.3862 && place.lat <= 52.3915 && place.lng >= -9.8396 && place.lng <= -9.827;
  }

  function outsideVillageDirection(place) {
    if (place.lng < -9.8396) return "left";
    if (place.lng > -9.827) return "right";
    if (place.lat > 52.3915) return "top";
    return "bottom";
  }

  function relevantMapLocations() {
    const yearEvents = currentYearEvents();
    return locations
      .filter((location) => hasValidCoordinates(location))
      .filter((location) => yearEvents.some((event) => event.locationId === location.id))
      .filter((location) => placeMatchesLocationFilter({ ...location, kind: "location" }, yearEvents));
  }

  function locationIsVisible(location) {
    const bounds = state.map?.getBounds?.();
    return Boolean(bounds?.contains?.([location.lng, location.lat]));
  }

  function mainStreetNeedsReturn() {
    if (!state.map) return false;
    if (state.map.getZoom() < 14.95) return true;
    const mapElement = state.map.getContainer();
    const villagePixel = state.map.project([-9.835, 52.3894]);
    const centerX = mapElement.clientWidth / 2;
    const centerY = mapElement.clientHeight / 2;
    const distance = Math.hypot(villagePixel.x - centerX, villagePixel.y - centerY);
    return distance > Math.min(105, Math.max(62, mapElement.clientWidth * 0.22));
  }

  function averagePlace(places) {
    const totals = places.reduce((sum, place) => ({
      lat: sum.lat + place.lat,
      lng: sum.lng + place.lng
    }), { lat: 0, lng: 0 });
    return {
      lat: totals.lat / places.length,
      lng: totals.lng / places.length
    };
  }

  function directionBetweenPlaces(from, to) {
    const lngDelta = to.lng - from.lng;
    const latDelta = to.lat - from.lat;
    if (Math.abs(lngDelta) >= Math.abs(latDelta)) {
      return lngDelta < 0 ? "left" : "right";
    }
    return latDelta > 0 ? "top" : "bottom";
  }

  function arrowForDirection(direction) {
    return {
      left: "\u2190",
      right: "\u2192",
      top: "\u2191",
      bottom: "\u2193"
    }[direction] || "\u2192";
  }

  function focusLocation(locationId, options = {}) {
    const location = locationById.get(locationId);
    if (!location || !state.map || !hasValidCoordinates(location)) return;

    setActiveTab("map");
    state.selectedLocationId = locationId;
    state.map.resize();
    state.map.flyTo({
      center: [location.lng, location.lat],
      zoom: 16.4,
      essential: true
    });

    if (options.openPanel) {
      renderMapPanel(locationId);
    }

    setActiveMapPoint(`location:${locationId}`);
    showMapPointPopup({
      geometry: { coordinates: [location.lng, location.lat] },
      properties: { name: location.name, type: location.type }
    });
    updateOutsideVillageIndicator();

    if (options.scroll) {
      document.querySelector("#explorer").scrollIntoView({ behavior: "smooth" });
    }
  }

  function focusEventLocations(eventId, options = {}) {
    const event = events.find((item) => item.id === eventId);
    if (!event || !state.map) return;

    const eventLocations = locationsForEvents(relatedEventsForEvent(event)).filter(hasValidCoordinates);
    if (!eventLocations.length) return;
    if (eventLocations.length === 1) {
      focusLocation(eventLocations[0].id, { openPanel: true, scroll: options.scroll });
      return;
    }

    setActiveTab("map");
    state.selectedLocationId = null;
    state.map.resize();
    const bounds = new maplibregl.LngLatBounds();
    eventLocations.forEach((location) => bounds.extend([location.lng, location.lat]));
    state.map.fitBounds(bounds, { padding: { top: 72, right: 48, bottom: 48, left: 48 }, maxZoom: 16.2, essential: true });
    renderMultiLocationMapPanel(event, eventLocations);
    setActiveMapPoint("");
    clearMapPointHover();
    setTimeout(updateOutsideVillageIndicator, 650);

    if (options.scroll) {
      document.querySelector("#explorer").scrollIntoView({ behavior: "smooth" });
    }
  }

  function renderMultiLocationMapPanel(event, eventLocations) {
    els.mapPanel.innerHTML = `
      <h3>${event.title}</h3>
      <p><strong>${event.category}</strong></p>
      <p>${formatTimeRange(event)} | ${modalLocationLabel(relatedEventsForEvent(event))}</p>
      <div class="panel-events">
        ${eventLocations.map((location) => `
          <div class="panel-event">
            <div class="panel-event-title-row">
              <button type="button" data-action="show-map" data-location-id="${location.id}">${location.name}</button>
            </div>
            <div>${location.type}</div>
          </div>
        `).join("")}
      </div>
    `;
  }

  function focusFeature(featureId) {
    const feature = mapFeatures.find((item) => item.id === featureId);
    if (!feature || !state.map || !hasValidCoordinates(feature)) return;

    setActiveTab("map");
    state.map.resize();
    state.map.flyTo({
      center: [feature.lng, feature.lat],
      zoom: 16.8,
      essential: true
    });

    setActiveMapPoint(`feature:${featureId}`);
    showMapPointPopup({
      geometry: { coordinates: [feature.lng, feature.lat] },
      properties: { name: feature.name, type: feature.type }
    });
    renderFeaturePanel(featureId);
    document.querySelector("#explorer").scrollIntoView({ behavior: "smooth" });
  }

  function filterByLocation(locationId) {
    state.filters.location = locationId;
    syncFilterInputs();
    renderSchedule();
    setActiveTab("map");
    focusLocation(locationId, { openPanel: true, scroll: true });
  }

  function showScheduleForLocation(locationId) {
    if (!locationById.has(locationId)) return;
    const firstLocationEvent = currentYearEvents().find((event) => event.locationId === locationId);
    if (!els.eventModal.hidden) {
      closeEventModal();
    }
    resetFilters(false);
    renderSchedule();
    setActiveTab("schedule", { scroll: true });
    if (firstLocationEvent) {
      setTimeout(() => focusEventCard(firstLocationEvent.id), 180);
    }
  }

  function showEventInSchedule(eventId) {
    if (!events.some((event) => event.id === eventId)) return;
    if (!els.eventModal.hidden) {
      closeEventModal();
    }
    resetFilters(false);
    renderSchedule();
    setActiveTab("schedule", { scroll: true });
    setTimeout(() => focusEventCard(eventId), 180);
  }

  function resetFilters(render = true) {
    state.filters = {
      search: "",
      day: "all",
      category: "all",
      location: "all",
      price: "all",
      family: false,
      now: false
    };
    state.locationDirectoryFilter = "all";
    syncFilterInputs();
    updateQuickFilterState("all");
    updateLocationFilterState();
    renderLocations();
    refreshMapMarkers();
    if (render) {
      renderSchedule();
    }
  }

  function applyQuickFilter(filterName) {
    state.filters.day = "all";
    state.filters.price = "all";
    state.filters.family = false;
    state.filters.category = "all";
    state.filters.now = false;

    if (filterName === "today") {
      state.filters.day = todayFilterDate();
    }

    if (filterName === "now") {
      state.filters.now = true;
      if (!isWithinFestivalDates(new Date())) {
        state.filters.day = todayFilterDate();
      }
    }

    if (filterName === "free") {
      state.filters.price = "free";
    }

    if (filterName === "family") {
      state.filters.family = true;
    }

    if (filterName === "music") {
      state.filters.category = "Music";
    }

    if (filterName === "kids") {
      state.filters.category = "Kids";
    }

    syncFilterInputs();
    updateQuickFilterState(filterName);
    renderSchedule();
  }

  function updateQuickFilterState(filterName) {
    els.quickFilters.forEach((button) => {
      button.classList.toggle("is-active", button.dataset.quickFilter === filterName);
    });
  }

  function inferQuickFilterState() {
    const noCategoryFilters = state.filters.price === "all" && !state.filters.family && state.filters.category === "all" && state.filters.location === "all";
    if (!state.filters.now && state.filters.day !== "all" && state.filters.day === todayFilterDate() && noCategoryFilters) return "today";
    if (state.filters.now && state.filters.price === "all" && !state.filters.family && state.filters.category === "all" && state.filters.location === "all") return "now";
    if (state.filters.price === "free" && !state.filters.family && state.filters.category === "all" && state.filters.day === "all") return "free";
    if (state.filters.family && state.filters.price === "all" && state.filters.category === "all" && state.filters.day === "all") return "family";
    if (state.filters.category === "Music" && state.filters.price === "all" && !state.filters.family && state.filters.day === "all") return "music";
    if (state.filters.category === "Kids" && state.filters.price === "all" && !state.filters.family && state.filters.day === "all") return "kids";
    return "all";
  }

  function syncFilterInputs() {
    els.searchInput.value = state.filters.search;
    els.dayFilter.value = state.filters.day;
    els.categoryFilter.value = state.filters.category;
    els.locationFilter.value = state.filters.location;
    els.priceFilter.value = state.filters.price;
    els.familyFilter.checked = state.filters.family;
    updateFilterClearState();
  }

  function filtersAreActive() {
    return Boolean(state.filters.search)
      || state.filters.day !== "all"
      || state.filters.category !== "all"
      || state.filters.location !== "all"
      || state.filters.price !== "all"
      || state.filters.family
      || state.filters.now
      || state.locationDirectoryFilter !== "all";
  }

  function updateFilterClearState() {
    if (els.clearSearchFilters) {
      els.clearSearchFilters.hidden = !filtersAreActive();
    }
    if (els.clearFilters) {
      els.clearFilters.hidden = true;
    }
  }

  function downloadCalendarEvent(eventId) {
    const event = events.find((item) => item.id === eventId);
    const location = locationById.get(event?.locationId);
    if (!event) return;

    const ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Ballyheigue Summer Festival//Festival Explorer//EN",
      "BEGIN:VEVENT",
      `UID:${event.id}@ballyheigue-summer-festival`,
      `DTSTAMP:${toCalendarDate(new Date())}`,
      `DTSTART:${toCalendarDate(eventStart(event))}`,
      `DTEND:${toCalendarDate(eventEnd(event))}`,
      `SUMMARY:${escapeIcs(event.title)}`,
      `LOCATION:${escapeIcs(eventLocationName(event) || "Ballyheigue")}`,
      `DESCRIPTION:${escapeIcs(event.description)}`,
      "END:VEVENT",
      "END:VCALENDAR"
    ].join("\r\n");

    const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${event.id}.ics`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  async function copyEventLink(eventId, button) {
    const url = `${window.location.origin}${window.location.pathname}#event-${eventId}`;
    try {
      await navigator.clipboard.writeText(url);
      button.textContent = "Copied";
      setTimeout(() => {
        button.textContent = "Copy event link";
      }, 1600);
    } catch {
      window.location.hash = `event-${eventId}`;
    }
  }

  async function shareEvent(eventId) {
    const event = events.find((item) => item.id === eventId);
    if (!event) return;

    const url = `${window.location.origin}${window.location.pathname}#event-${event.id}`;
    if (navigator.share) {
      await navigator.share({
        title: event.title,
        text: event.description,
        url
      });
    } else if (navigator.clipboard) {
      await navigator.clipboard.writeText(url);
      alert("Event link copied.");
    }
  }

  function focusEventFromHash() {
    const id = window.location.hash.replace("#event-", "");
    if (!id) return;
    dismissHero();
    focusEventCard(id);
  }

  function alignInitialHash() {
    if (!window.location.hash || window.location.hash.startsWith("#event-")) {
      return;
    }

    const hashToTab = {
      "#schedule": "schedule",
      "#map-section": "map",
      "#locations": "locations",
      "#explorer": state.activeTab
    };
    if (hashToTab[window.location.hash]) {
      dismissHero();
      setActiveTab(hashToTab[window.location.hash]);
    }

    const sectionSelector = hashToTab[window.location.hash] ? "#explorer" : window.location.hash;
    const section = document.querySelector(sectionSelector);
    if (section) {
      section.scrollIntoView({ block: "start" });
    }
  }

  function focusEventCard(eventId) {
    const card = document.querySelector(`#event-${CSS.escape(eventId)}`);
    if (!card) return;
    card.scrollIntoView({ behavior: "smooth", block: "center" });
    card.classList.remove("highlight-pulse");
    requestAnimationFrame(() => card.classList.add("highlight-pulse"));
  }

  function groupBy(items, key) {
    const grouped = new Map();
    items.forEach((item) => {
      const value = item[key];
      grouped.set(value, [...(grouped.get(value) || []), item]);
    });
    return [...grouped.entries()];
  }

  function registerMapIcons() {
    ["pub", "pub-food", "food", "shop", "statue", "parking", "toilet", "sauna", "beach", "event"].forEach((kind) => {
      const id = `festival-icon-${kind}`;
      if (!state.map.hasImage(id)) {
        state.map.addImage(id, drawMapIcon(kind), { pixelRatio: 2 });
      }
      const haloId = `festival-halo-${kind}`;
      if (!state.map.hasImage(haloId)) {
        state.map.addImage(haloId, drawMapHalo(kind), { pixelRatio: 2 });
      }
    });
  }

  function drawMapHalo(kind) {
    const canvas = document.createElement("canvas");
    canvas.width = 96;
    canvas.height = 96;
    const ctx = canvas.getContext("2d");
    const radius = markerHaloRadius(kind);

    ctx.clearRect(0, 0, 96, 96);
    ctx.beginPath();
    ctx.arc(48, 48, radius, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(106, 164, 111, 0.26)";
    ctx.fill();
    ctx.lineWidth = 5;
    ctx.strokeStyle = "#fff4d6";
    ctx.stroke();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "rgba(5, 5, 5, 0.32)";
    ctx.stroke();
    return ctx.getImageData(0, 0, canvas.width, canvas.height);
  }

  function markerHaloRadius(kind) {
    return {
      pub: 43,
      "pub-food": 44,
      food: 36,
      shop: 36,
      statue: 31,
      parking: 34,
      toilet: 34,
      sauna: 34,
      beach: 36,
      event: 36
    }[kind] || 36;
  }

  function drawMapIcon(kind) {
    const canvas = document.createElement("canvas");
    canvas.width = 96;
    canvas.height = 96;
    const ctx = canvas.getContext("2d");
    const orange = "#ff7a18";
    const blue = "#087ca7";
    const cream = "#fff4d6";
    const black = "#050505";
    const radius = {
      pub: 37,
      "pub-food": 39,
      food: 31,
      shop: 31,
      statue: 26,
      parking: 29,
      toilet: 29,
      sauna: 29,
      beach: 31,
      event: 31
    }[kind] || 31;

    ctx.clearRect(0, 0, 96, 96);
    ctx.shadowColor = "rgba(0,0,0,0.24)";
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 5;
    ctx.beginPath();
    ctx.arc(48, 48, radius, 0, Math.PI * 2);
    ctx.fillStyle = ["beach", "event"].includes(kind) ? blue : orange;
    ctx.fill();
    ctx.shadowColor = "transparent";
    ctx.lineWidth = kind === "pub" || kind === "pub-food" ? 7 : 5;
    ctx.strokeStyle = cream;
    ctx.stroke();
    ctx.fillStyle = ["beach", "event"].includes(kind) ? cream : black;
    ctx.strokeStyle = ctx.fillStyle;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    drawIconGlyph(ctx, kind, black);
    return ctx.getImageData(0, 0, canvas.width, canvas.height);
  }

  function drawIconGlyph(ctx, kind, black) {
    if (kind === "pub-food") {
      ctx.save();
      ctx.translate(-8, 0);
      ctx.scale(0.78, 0.78);
      drawBeerGlyph(ctx);
      ctx.restore();
      ctx.save();
      ctx.translate(18, 0);
      ctx.scale(0.78, 0.78);
      drawFoodGlyph(ctx);
      ctx.restore();
      return;
    }
    if (kind === "pub") return drawBeerGlyph(ctx);
    if (kind === "food") return drawFoodGlyph(ctx);
    if (kind === "shop") return drawShopGlyph(ctx);
    if (kind === "statue") return drawStatueGlyph(ctx);
    if (kind === "sauna") return drawSaunaGlyph(ctx);
    if (kind === "parking" || kind === "toilet") {
      ctx.font = `900 ${kind === "toilet" ? 24 : 33}px Arial`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(kind === "toilet" ? "WC" : "P", 48, 50);
      return;
    }
    if (kind === "beach") return drawBeachGlyph(ctx);
    drawPinGlyph(ctx);
  }

  function drawBeerGlyph(ctx) {
    ctx.fillRect(38, 38, 20, 30);
    ctx.beginPath();
    ctx.moveTo(36, 37);
    ctx.bezierCurveTo(36, 28, 44, 29, 46, 34);
    ctx.bezierCurveTo(49, 27, 58, 29, 58, 37);
    ctx.lineTo(58, 42);
    ctx.lineTo(36, 42);
    ctx.closePath();
    ctx.fill();
  }

  function drawFoodGlyph(ctx) {
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(36, 29);
    ctx.lineTo(36, 68);
    ctx.moveTo(29, 29);
    ctx.lineTo(29, 44);
    ctx.quadraticCurveTo(29, 53, 36, 53);
    ctx.moveTo(43, 29);
    ctx.lineTo(43, 44);
    ctx.quadraticCurveTo(43, 53, 36, 53);
    ctx.moveTo(59, 29);
    ctx.lineTo(59, 68);
    ctx.moveTo(59, 29);
    ctx.quadraticCurveTo(70, 39, 65, 56);
    ctx.quadraticCurveTo(63, 61, 59, 61);
    ctx.stroke();
  }

  function drawShopGlyph(ctx) {
    ctx.beginPath();
    ctx.moveTo(29, 39);
    ctx.lineTo(59, 39);
    ctx.lineTo(64, 70);
    ctx.lineTo(25, 70);
    ctx.closePath();
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(44, 39, 10, Math.PI, Math.PI * 2);
    ctx.stroke();
  }

  function drawStatueGlyph(ctx) {
    ctx.beginPath();
    ctx.arc(48, 30, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(42, 38);
    ctx.lineTo(55, 38);
    ctx.lineTo(59, 58);
    ctx.lineTo(53, 61);
    ctx.lineTo(52, 72);
    ctx.lineTo(45, 72);
    ctx.lineTo(46, 61);
    ctx.lineTo(40, 72);
    ctx.lineTo(34, 72);
    ctx.lineTo(40, 56);
    ctx.closePath();
    ctx.fill();
  }

  function drawSaunaGlyph(ctx) {
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(34, 31);
    ctx.quadraticCurveTo(28, 38, 34, 45);
    ctx.moveTo(48, 28);
    ctx.quadraticCurveTo(42, 37, 48, 45);
    ctx.moveTo(62, 31);
    ctx.quadraticCurveTo(56, 38, 62, 45);
    ctx.stroke();
    ctx.fillRect(31, 55, 34, 11);
  }

  function drawBeachGlyph(ctx) {
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(30, 62);
    ctx.quadraticCurveTo(39, 56, 48, 62);
    ctx.quadraticCurveTo(57, 68, 66, 62);
    ctx.moveTo(48, 58);
    ctx.lineTo(48, 34);
    ctx.moveTo(29, 41);
    ctx.quadraticCurveTo(48, 25, 67, 41);
    ctx.stroke();
  }

  function drawPinGlyph(ctx) {
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(48, 42, 12, 0, Math.PI * 2);
    ctx.moveTo(48, 54);
    ctx.lineTo(48, 69);
    ctx.stroke();
  }

  function markerSortKey(kind) {
    return {
      pub: 70,
      "pub-food": 72,
      food: 60,
      shop: 55,
      statue: 50,
      parking: 45,
      toilet: 45,
      sauna: 50,
      beach: 35,
      event: 30
    }[kind] || 20;
  }

  function markerLayerPriority(place, pointType, kind) {
    if (["pub", "pub-food"].includes(kind)) return 5;
    if (pointType === "location") return 4;
    if (kind === "food") return 3;
    if (kind === "shop") return 2;
    return 1;
  }

  function markerClassName(place, isFeature = false) {
    const kind = markerKind(place);
    return [
      "festival-marker",
      isFeature ? "festival-feature-marker" : "",
      `marker-${kind}`,
      ["pub", "food", "shop", "statue"].includes(kind) ? "marker-priority" : ""
    ].filter(Boolean).join(" ");
  }

  function markerKind(place) {
    const type = String(place?.type || "").toLowerCase();
    const icon = String(place?.icon || "").toLowerCase();
    const name = String(place?.name || "").toLowerCase();

    if (name.includes("roger casement") || type.includes("statue")) return "statue";
    if (type.includes("pub") || type.includes("bar")) return "pub";
    if (["restaurant", "cafe", "takeaway", "food"].some((value) => type.includes(value) || icon.includes(value))) return "food";
    if (["shop", "pharmacy"].some((value) => type.includes(value) || icon.includes(value))) return "shop";
    if (type.includes("parking") || icon.includes("parking")) return "parking";
    if (type.includes("toilet") || icon.includes("toilet")) return "toilet";
    if (type.includes("sauna") || icon.includes("sauna") || name.includes("sauna")) return "sauna";
    if (type.includes("beach")) return "beach";
    return "event";
  }

  function markerIcon(place) {
    const icons = {
      pub: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 8h10l-1.5 13h-7L7 8Z"/><path class="beer-foam" d="M7 7c0-2 1.4-3.3 3-2.4.6-1.4 2.8-1.4 3.4 0C15 3.8 17 5 17 7v2H7V7Z"/></svg>`,
      food: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3h1.4v18H7V3Z"/><path d="M4.4 3h1.3v7.3c0 1.8 1 2.8 2 2.8v2c-2.8 0-4.1-2.1-4.1-4.8V3Z"/><path d="M10.3 3h1.3v7.3c0 2.7-1.3 4.8-4.1 4.8v-2c1 0 2-1 2-2.8V3Z"/><path d="M16.4 3h1.8v18h-1.8V3Z"/><path d="M16.4 3c2.6 1.5 3.8 4 3.8 7.7 0 2.7-1.4 4.6-3.8 5V3Z"/></svg>`,
      shop: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 8h12l1.5 13H4L5 8Z"/><path d="M9 8c0-3 1.3-5 3.3-5 1.7 0 3 1.7 3 4"/><path d="M11 8c0-2.2 1-3.6 2.4-3.6 1.5 0 2.7 1.6 2.7 3.6"/><path d="M17 8h2l1 13h-2.3"/></svg>`,
      statue: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5c1.4 0 2.3 1 2.2 2.4-.1 1.2-.8 2.1-2.2 2.1s-2.1-.9-2.2-2.1c-.1-1.4.8-2.4 2.2-2.4Z"/><path d="M9.8 7h4.4l1.2 6.4 2.1 1.5-.7 1.4-2.4-.8-1.1 6h-2.1l.3-6.1h-1l-2.2 6.1H6.2l2.6-7.7L9.8 7Z"/></svg>`,
      parking: `<span class="marker-text">P</span>`,
      toilet: `<span class="marker-text">WC</span>`,
      beach: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 19c3-2 6 2 9 0s6 2 9 0"/><path d="M12 16V7"/><path d="M5 10c4-5 10-5 14 0H5Z"/></svg>`,
      event: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s7-5 7-11a7 7 0 0 0-14 0c0 6 7 11 7 11Z"/><path d="M12 10h.01"/></svg>`
    };
    return icons[markerKind(place)] || icons.event;
  }

  function renderMapKeyIcons() {
    document.querySelectorAll("[data-key-kind]").forEach((item) => {
      const kind = item.dataset.keyKind;
      item.classList.add(`key-${kind}`);
      item.innerHTML = markerIcon({ type: kind === "event" ? "Festival venue" : kind, icon: kind });
    });
  }


  function eventStart(event) {
    return new Date(`${event.date}T${event.startTime}:00`);
  }

  function eventEnd(event) {
    if (!event.endTime) {
      return new Date(eventStart(event).getTime() + 60 * 60 * 1000);
    }
    return new Date(`${event.date}T${event.endTime}:00`);
  }

  function sameDate(a, b) {
    return a.getFullYear() === b.getFullYear()
      && a.getMonth() === b.getMonth()
      && a.getDate() === b.getDate();
  }

  function isTodayForSelectedYear(date) {
    const today = new Date();
    return today.getFullYear() === state.year && date === today.toISOString().slice(0, 10);
  }

  function formatDate(dateString) {
    return new Intl.DateTimeFormat("en-IE", {
      month: "short",
      day: "numeric",
      year: "numeric"
    }).format(new Date(`${dateString}T12:00:00`));
  }

  function todayFilterDate() {
    const yearEvents = currentYearEvents();
    const dates = uniqueValues(yearEvents.map((event) => event.date)).sort();
    const today = new Date().toISOString().slice(0, 10);
    return dates.includes(today) ? today : dates[0] || "all";
  }

  function isWithinFestivalDates(date) {
    const yearEvents = currentYearEvents();
    const dates = uniqueValues(yearEvents.map((event) => event.date)).sort();
    if (!dates.length) return false;
    const day = date.toISOString().slice(0, 10);
    return day >= dates[0] && day <= dates[dates.length - 1];
  }

  function eventMatchesNowFilter(event) {
    const now = new Date();
    if (!isWithinFestivalDates(now)) {
      return event.date === todayFilterDate();
    }
    const soon = new Date(now.getTime() + 2 * 60 * 60 * 1000);
    return eventEnd(event) >= now && eventStart(event) <= soon;
  }

  function shortDayTime(event) {
    const day = String(event.dayLabel || "").slice(0, 3) || formatDate(event.date).split(" ")[0];
    return `${day} ${formatTimeRange(event)}`;
  }

  function eventLocationName(event) {
    const location = locationById.get(event?.locationId);
    return event?.locationLabel || location?.name || "Location TBC";
  }

  function formatTimeRange(event) {
    if (event.timeLabel) return event.timeLabel;
    if (event.hasExplicitEnd) return `${event.startTime} to ${event.endTime}`;
    return event.startTime || "Time TBC";
  }

  function formatDuration(event) {
    if (!event.hasExplicitEnd) return "Not specified";
    const minutes = Math.max(0, Math.round((eventEnd(event) - eventStart(event)) / 60000));
    if (!minutes) return "Time TBC";
    const hours = Math.floor(minutes / 60);
    const remaining = minutes % 60;
    if (!hours) return `${remaining} min`;
    if (!remaining) return `${hours} hr${hours === 1 ? "" : "s"}`;
    return `${hours} hr ${remaining} min`;
  }

  function eventCostLabel(event) {
    return event.price || "Free";
  }

  function isFree(event) {
    return !event.price || event.price.toLowerCase().includes("free");
  }

  function eventPriceBadge(event) {
    return event.price && !isFree(event)
      ? `<span class="inline-price">${event.price}</span>`
      : "";
  }

  function directionsLink(place) {
    if (!hasValidCoordinates(place)) return "";
    const destination = encodeURIComponent(`${place.lat},${place.lng}`);
    return `
      <a class="directions-link" href="https://www.google.com/maps/dir/?api=1&destination=${destination}&travelmode=walking" target="_blank" rel="noopener noreferrer">
        Open in Google Maps
      </a>
    `;
  }

  function toCalendarDate(date) {
    return date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  }

  function escapeIcs(value) {
    return String(value)
      .replace(/\\/g, "\\\\")
      .replace(/;/g, "\\;")
      .replace(/,/g, "\\,")
      .replace(/\n/g, "\\n");
  }

  init();
})();
