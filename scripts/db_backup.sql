--
-- PostgreSQL database dump
--

\restrict CbYUjS9NOp3NI6ZefiZj8OtdxLd7UOqYHBE9Mto7G50jWep0cwe4URVxg63o6vz

-- Dumped from database version 15.15
-- Dumped by pg_dump version 15.15

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: stg; Type: SCHEMA; Schema: -; Owner: admin
--

CREATE SCHEMA stg;


ALTER SCHEMA stg OWNER TO admin;

--
-- Name: booking_status_enum; Type: TYPE; Schema: public; Owner: admin
--

CREATE TYPE public.booking_status_enum AS ENUM (
    'confirmed',
    'staying',
    'completed',
    'cancelled'
);


ALTER TYPE public.booking_status_enum OWNER TO admin;

--
-- Name: room_status_enum; Type: TYPE; Schema: public; Owner: admin
--

CREATE TYPE public.room_status_enum AS ENUM (
    'available',
    'occupied',
    'dirty',
    'maintenance'
);


ALTER TYPE public.room_status_enum OWNER TO admin;

--
-- Name: room_type_enum; Type: TYPE; Schema: public; Owner: admin
--

CREATE TYPE public.room_type_enum AS ENUM (
    'standard',
    'deluxe',
    'dorm'
);


ALTER TYPE public.room_type_enum OWNER TO admin;

--
-- Name: task_status_enum; Type: TYPE; Schema: public; Owner: admin
--

CREATE TYPE public.task_status_enum AS ENUM (
    'pending',
    'in_progress',
    'done'
);


ALTER TYPE public.task_status_enum OWNER TO admin;

--
-- Name: user_role_enum; Type: TYPE; Schema: public; Owner: admin
--

CREATE TYPE public.user_role_enum AS ENUM (
    'admin',
    'manager',
    'cleaner'
);


ALTER TYPE public.user_role_enum OWNER TO admin;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: ab_permission; Type: TABLE; Schema: public; Owner: admin
--

CREATE TABLE public.ab_permission (
    id integer NOT NULL,
    name character varying(100) NOT NULL
);


ALTER TABLE public.ab_permission OWNER TO admin;

--
-- Name: ab_permission_id_seq; Type: SEQUENCE; Schema: public; Owner: admin
--

CREATE SEQUENCE public.ab_permission_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.ab_permission_id_seq OWNER TO admin;

--
-- Name: ab_permission_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: admin
--

ALTER SEQUENCE public.ab_permission_id_seq OWNED BY public.ab_permission.id;


--
-- Name: ab_permission_view; Type: TABLE; Schema: public; Owner: admin
--

CREATE TABLE public.ab_permission_view (
    id integer NOT NULL,
    permission_id integer,
    view_menu_id integer
);


ALTER TABLE public.ab_permission_view OWNER TO admin;

--
-- Name: ab_permission_view_id_seq; Type: SEQUENCE; Schema: public; Owner: admin
--

CREATE SEQUENCE public.ab_permission_view_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.ab_permission_view_id_seq OWNER TO admin;

--
-- Name: ab_permission_view_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: admin
--

ALTER SEQUENCE public.ab_permission_view_id_seq OWNED BY public.ab_permission_view.id;


--
-- Name: ab_permission_view_role; Type: TABLE; Schema: public; Owner: admin
--

CREATE TABLE public.ab_permission_view_role (
    id integer NOT NULL,
    permission_view_id integer,
    role_id integer
);


ALTER TABLE public.ab_permission_view_role OWNER TO admin;

--
-- Name: ab_permission_view_role_id_seq; Type: SEQUENCE; Schema: public; Owner: admin
--

CREATE SEQUENCE public.ab_permission_view_role_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.ab_permission_view_role_id_seq OWNER TO admin;

--
-- Name: ab_permission_view_role_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: admin
--

ALTER SEQUENCE public.ab_permission_view_role_id_seq OWNED BY public.ab_permission_view_role.id;


--
-- Name: ab_register_user; Type: TABLE; Schema: public; Owner: admin
--

CREATE TABLE public.ab_register_user (
    id integer NOT NULL,
    first_name character varying(256) NOT NULL,
    last_name character varying(256) NOT NULL,
    username character varying(512) NOT NULL,
    password character varying(256),
    email character varying(512) NOT NULL,
    registration_date timestamp without time zone,
    registration_hash character varying(256)
);


ALTER TABLE public.ab_register_user OWNER TO admin;

--
-- Name: ab_register_user_id_seq; Type: SEQUENCE; Schema: public; Owner: admin
--

CREATE SEQUENCE public.ab_register_user_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.ab_register_user_id_seq OWNER TO admin;

--
-- Name: ab_register_user_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: admin
--

ALTER SEQUENCE public.ab_register_user_id_seq OWNED BY public.ab_register_user.id;


--
-- Name: ab_role; Type: TABLE; Schema: public; Owner: admin
--

CREATE TABLE public.ab_role (
    id integer NOT NULL,
    name character varying(64) NOT NULL
);


ALTER TABLE public.ab_role OWNER TO admin;

--
-- Name: ab_role_id_seq; Type: SEQUENCE; Schema: public; Owner: admin
--

CREATE SEQUENCE public.ab_role_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.ab_role_id_seq OWNER TO admin;

--
-- Name: ab_role_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: admin
--

ALTER SEQUENCE public.ab_role_id_seq OWNED BY public.ab_role.id;


--
-- Name: ab_user; Type: TABLE; Schema: public; Owner: admin
--

CREATE TABLE public.ab_user (
    id integer NOT NULL,
    first_name character varying(256) NOT NULL,
    last_name character varying(256) NOT NULL,
    username character varying(512) NOT NULL,
    password character varying(256),
    active boolean,
    email character varying(512) NOT NULL,
    last_login timestamp without time zone,
    login_count integer,
    fail_login_count integer,
    created_on timestamp without time zone,
    changed_on timestamp without time zone,
    created_by_fk integer,
    changed_by_fk integer
);


ALTER TABLE public.ab_user OWNER TO admin;

--
-- Name: ab_user_id_seq; Type: SEQUENCE; Schema: public; Owner: admin
--

CREATE SEQUENCE public.ab_user_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.ab_user_id_seq OWNER TO admin;

--
-- Name: ab_user_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: admin
--

ALTER SEQUENCE public.ab_user_id_seq OWNED BY public.ab_user.id;


--
-- Name: ab_user_role; Type: TABLE; Schema: public; Owner: admin
--

CREATE TABLE public.ab_user_role (
    id integer NOT NULL,
    user_id integer,
    role_id integer
);


ALTER TABLE public.ab_user_role OWNER TO admin;

--
-- Name: ab_user_role_id_seq; Type: SEQUENCE; Schema: public; Owner: admin
--

CREATE SEQUENCE public.ab_user_role_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.ab_user_role_id_seq OWNER TO admin;

--
-- Name: ab_user_role_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: admin
--

ALTER SEQUENCE public.ab_user_role_id_seq OWNED BY public.ab_user_role.id;


--
-- Name: ab_view_menu; Type: TABLE; Schema: public; Owner: admin
--

CREATE TABLE public.ab_view_menu (
    id integer NOT NULL,
    name character varying(250) NOT NULL
);


ALTER TABLE public.ab_view_menu OWNER TO admin;

--
-- Name: ab_view_menu_id_seq; Type: SEQUENCE; Schema: public; Owner: admin
--

CREATE SEQUENCE public.ab_view_menu_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.ab_view_menu_id_seq OWNER TO admin;

--
-- Name: ab_view_menu_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: admin
--

ALTER SEQUENCE public.ab_view_menu_id_seq OWNED BY public.ab_view_menu.id;


--
-- Name: alembic_version; Type: TABLE; Schema: public; Owner: admin
--

CREATE TABLE public.alembic_version (
    version_num character varying(32) NOT NULL
);


ALTER TABLE public.alembic_version OWNER TO admin;

--
-- Name: bookings; Type: TABLE; Schema: public; Owner: admin
--

CREATE TABLE public.bookings (
    booking_id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid,
    room_id uuid,
    client_id uuid,
    check_in timestamp without time zone NOT NULL,
    check_out timestamp without time zone NOT NULL,
    total_price numeric(10,2),
    status public.booking_status_enum DEFAULT 'confirmed'::public.booking_status_enum,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    loaded_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.bookings OWNER TO admin;

--
-- Name: callback_request; Type: TABLE; Schema: public; Owner: admin
--

CREATE TABLE public.callback_request (
    id integer NOT NULL,
    created_at timestamp with time zone NOT NULL,
    priority_weight integer NOT NULL,
    callback_data json NOT NULL,
    callback_type character varying(20) NOT NULL,
    processor_subdir character varying(2000)
);


ALTER TABLE public.callback_request OWNER TO admin;

--
-- Name: callback_request_id_seq; Type: SEQUENCE; Schema: public; Owner: admin
--

CREATE SEQUENCE public.callback_request_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.callback_request_id_seq OWNER TO admin;

--
-- Name: callback_request_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: admin
--

ALTER SEQUENCE public.callback_request_id_seq OWNED BY public.callback_request.id;


--
-- Name: cleaning_tasks; Type: TABLE; Schema: public; Owner: admin
--

CREATE TABLE public.cleaning_tasks (
    task_id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid,
    room_id uuid,
    assigned_to integer,
    status public.task_status_enum DEFAULT 'pending'::public.task_status_enum,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    finished_at timestamp without time zone,
    loaded_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.cleaning_tasks OWNER TO admin;

--
-- Name: clients; Type: TABLE; Schema: public; Owner: admin
--

CREATE TABLE public.clients (
    client_id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid,
    first_name character varying(100),
    last_name character varying(100),
    email character varying(255),
    phone character varying(50),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    loaded_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.clients OWNER TO admin;

--
-- Name: connection; Type: TABLE; Schema: public; Owner: admin
--

CREATE TABLE public.connection (
    id integer NOT NULL,
    conn_id character varying(250) NOT NULL,
    conn_type character varying(500) NOT NULL,
    description text,
    host character varying(500),
    schema character varying(500),
    login character varying(500),
    password character varying(5000),
    port integer,
    is_encrypted boolean,
    is_extra_encrypted boolean,
    extra text
);


ALTER TABLE public.connection OWNER TO admin;

--
-- Name: connection_id_seq; Type: SEQUENCE; Schema: public; Owner: admin
--

CREATE SEQUENCE public.connection_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.connection_id_seq OWNER TO admin;

--
-- Name: connection_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: admin
--

ALTER SEQUENCE public.connection_id_seq OWNED BY public.connection.id;


--
-- Name: dag; Type: TABLE; Schema: public; Owner: admin
--

CREATE TABLE public.dag (
    dag_id character varying(250) NOT NULL,
    root_dag_id character varying(250),
    is_paused boolean,
    is_subdag boolean,
    is_active boolean,
    last_parsed_time timestamp with time zone,
    last_pickled timestamp with time zone,
    last_expired timestamp with time zone,
    scheduler_lock boolean,
    pickle_id integer,
    fileloc character varying(2000),
    processor_subdir character varying(2000),
    owners character varying(2000),
    description text,
    default_view character varying(25),
    schedule_interval text,
    timetable_description character varying(1000),
    max_active_tasks integer NOT NULL,
    max_active_runs integer,
    has_task_concurrency_limits boolean NOT NULL,
    has_import_errors boolean DEFAULT false,
    next_dagrun timestamp with time zone,
    next_dagrun_data_interval_start timestamp with time zone,
    next_dagrun_data_interval_end timestamp with time zone,
    next_dagrun_create_after timestamp with time zone
);


ALTER TABLE public.dag OWNER TO admin;

--
-- Name: dag_code; Type: TABLE; Schema: public; Owner: admin
--

CREATE TABLE public.dag_code (
    fileloc_hash bigint NOT NULL,
    fileloc character varying(2000) NOT NULL,
    last_updated timestamp with time zone NOT NULL,
    source_code text NOT NULL
);


ALTER TABLE public.dag_code OWNER TO admin;

--
-- Name: dag_owner_attributes; Type: TABLE; Schema: public; Owner: admin
--

CREATE TABLE public.dag_owner_attributes (
    dag_id character varying(250) NOT NULL,
    owner character varying(500) NOT NULL,
    link character varying(500) NOT NULL
);


ALTER TABLE public.dag_owner_attributes OWNER TO admin;

--
-- Name: dag_pickle; Type: TABLE; Schema: public; Owner: admin
--

CREATE TABLE public.dag_pickle (
    id integer NOT NULL,
    pickle bytea,
    created_dttm timestamp with time zone,
    pickle_hash bigint
);


ALTER TABLE public.dag_pickle OWNER TO admin;

--
-- Name: dag_pickle_id_seq; Type: SEQUENCE; Schema: public; Owner: admin
--

CREATE SEQUENCE public.dag_pickle_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.dag_pickle_id_seq OWNER TO admin;

--
-- Name: dag_pickle_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: admin
--

ALTER SEQUENCE public.dag_pickle_id_seq OWNED BY public.dag_pickle.id;


--
-- Name: dag_run; Type: TABLE; Schema: public; Owner: admin
--

CREATE TABLE public.dag_run (
    id integer NOT NULL,
    dag_id character varying(250) NOT NULL,
    queued_at timestamp with time zone,
    execution_date timestamp with time zone NOT NULL,
    start_date timestamp with time zone,
    end_date timestamp with time zone,
    state character varying(50),
    run_id character varying(250) NOT NULL,
    creating_job_id integer,
    external_trigger boolean,
    run_type character varying(50) NOT NULL,
    conf bytea,
    data_interval_start timestamp with time zone,
    data_interval_end timestamp with time zone,
    last_scheduling_decision timestamp with time zone,
    dag_hash character varying(32),
    log_template_id integer,
    updated_at timestamp with time zone
);


ALTER TABLE public.dag_run OWNER TO admin;

--
-- Name: dag_run_id_seq; Type: SEQUENCE; Schema: public; Owner: admin
--

CREATE SEQUENCE public.dag_run_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.dag_run_id_seq OWNER TO admin;

--
-- Name: dag_run_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: admin
--

ALTER SEQUENCE public.dag_run_id_seq OWNED BY public.dag_run.id;


--
-- Name: dag_run_note; Type: TABLE; Schema: public; Owner: admin
--

CREATE TABLE public.dag_run_note (
    user_id integer,
    dag_run_id integer NOT NULL,
    content character varying(1000),
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);


ALTER TABLE public.dag_run_note OWNER TO admin;

--
-- Name: dag_schedule_dataset_reference; Type: TABLE; Schema: public; Owner: admin
--

CREATE TABLE public.dag_schedule_dataset_reference (
    dataset_id integer NOT NULL,
    dag_id character varying(250) NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);


ALTER TABLE public.dag_schedule_dataset_reference OWNER TO admin;

--
-- Name: dag_tag; Type: TABLE; Schema: public; Owner: admin
--

CREATE TABLE public.dag_tag (
    name character varying(100) NOT NULL,
    dag_id character varying(250) NOT NULL
);


ALTER TABLE public.dag_tag OWNER TO admin;

--
-- Name: dag_warning; Type: TABLE; Schema: public; Owner: admin
--

CREATE TABLE public.dag_warning (
    dag_id character varying(250) NOT NULL,
    warning_type character varying(50) NOT NULL,
    message text NOT NULL,
    "timestamp" timestamp with time zone NOT NULL
);


ALTER TABLE public.dag_warning OWNER TO admin;

--
-- Name: dagrun_dataset_event; Type: TABLE; Schema: public; Owner: admin
--

CREATE TABLE public.dagrun_dataset_event (
    dag_run_id integer NOT NULL,
    event_id integer NOT NULL
);


ALTER TABLE public.dagrun_dataset_event OWNER TO admin;

--
-- Name: dataset; Type: TABLE; Schema: public; Owner: admin
--

CREATE TABLE public.dataset (
    id integer NOT NULL,
    uri character varying(3000) NOT NULL,
    extra json NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    is_orphaned boolean DEFAULT false NOT NULL
);


ALTER TABLE public.dataset OWNER TO admin;

--
-- Name: dataset_dag_run_queue; Type: TABLE; Schema: public; Owner: admin
--

CREATE TABLE public.dataset_dag_run_queue (
    dataset_id integer NOT NULL,
    target_dag_id character varying(250) NOT NULL,
    created_at timestamp with time zone NOT NULL
);


ALTER TABLE public.dataset_dag_run_queue OWNER TO admin;

--
-- Name: dataset_event; Type: TABLE; Schema: public; Owner: admin
--

CREATE TABLE public.dataset_event (
    id integer NOT NULL,
    dataset_id integer NOT NULL,
    extra json NOT NULL,
    source_task_id character varying(250),
    source_dag_id character varying(250),
    source_run_id character varying(250),
    source_map_index integer DEFAULT '-1'::integer,
    "timestamp" timestamp with time zone NOT NULL
);


ALTER TABLE public.dataset_event OWNER TO admin;

--
-- Name: dataset_event_id_seq; Type: SEQUENCE; Schema: public; Owner: admin
--

CREATE SEQUENCE public.dataset_event_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.dataset_event_id_seq OWNER TO admin;

--
-- Name: dataset_event_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: admin
--

ALTER SEQUENCE public.dataset_event_id_seq OWNED BY public.dataset_event.id;


--
-- Name: dataset_id_seq; Type: SEQUENCE; Schema: public; Owner: admin
--

CREATE SEQUENCE public.dataset_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.dataset_id_seq OWNER TO admin;

--
-- Name: dataset_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: admin
--

ALTER SEQUENCE public.dataset_id_seq OWNED BY public.dataset.id;


--
-- Name: import_error; Type: TABLE; Schema: public; Owner: admin
--

CREATE TABLE public.import_error (
    id integer NOT NULL,
    "timestamp" timestamp with time zone,
    filename character varying(1024),
    stacktrace text
);


ALTER TABLE public.import_error OWNER TO admin;

--
-- Name: import_error_id_seq; Type: SEQUENCE; Schema: public; Owner: admin
--

CREATE SEQUENCE public.import_error_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.import_error_id_seq OWNER TO admin;

--
-- Name: import_error_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: admin
--

ALTER SEQUENCE public.import_error_id_seq OWNED BY public.import_error.id;


--
-- Name: job; Type: TABLE; Schema: public; Owner: admin
--

CREATE TABLE public.job (
    id integer NOT NULL,
    dag_id character varying(250),
    state character varying(20),
    job_type character varying(30),
    start_date timestamp with time zone,
    end_date timestamp with time zone,
    latest_heartbeat timestamp with time zone,
    executor_class character varying(500),
    hostname character varying(500),
    unixname character varying(1000)
);


ALTER TABLE public.job OWNER TO admin;

--
-- Name: job_id_seq; Type: SEQUENCE; Schema: public; Owner: admin
--

CREATE SEQUENCE public.job_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.job_id_seq OWNER TO admin;

--
-- Name: job_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: admin
--

ALTER SEQUENCE public.job_id_seq OWNED BY public.job.id;


--
-- Name: log; Type: TABLE; Schema: public; Owner: admin
--

CREATE TABLE public.log (
    id integer NOT NULL,
    dttm timestamp with time zone,
    dag_id character varying(250),
    task_id character varying(250),
    map_index integer,
    event character varying(30),
    execution_date timestamp with time zone,
    owner character varying(500),
    extra text
);


ALTER TABLE public.log OWNER TO admin;

--
-- Name: log_id_seq; Type: SEQUENCE; Schema: public; Owner: admin
--

CREATE SEQUENCE public.log_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.log_id_seq OWNER TO admin;

--
-- Name: log_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: admin
--

ALTER SEQUENCE public.log_id_seq OWNED BY public.log.id;


--
-- Name: log_template; Type: TABLE; Schema: public; Owner: admin
--

CREATE TABLE public.log_template (
    id integer NOT NULL,
    filename text NOT NULL,
    elasticsearch_id text NOT NULL,
    created_at timestamp with time zone NOT NULL
);


ALTER TABLE public.log_template OWNER TO admin;

--
-- Name: log_template_id_seq; Type: SEQUENCE; Schema: public; Owner: admin
--

CREATE SEQUENCE public.log_template_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.log_template_id_seq OWNER TO admin;

--
-- Name: log_template_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: admin
--

ALTER SEQUENCE public.log_template_id_seq OWNED BY public.log_template.id;


--
-- Name: rendered_task_instance_fields; Type: TABLE; Schema: public; Owner: admin
--

CREATE TABLE public.rendered_task_instance_fields (
    dag_id character varying(250) NOT NULL,
    task_id character varying(250) NOT NULL,
    run_id character varying(250) NOT NULL,
    map_index integer DEFAULT '-1'::integer NOT NULL,
    rendered_fields json NOT NULL,
    k8s_pod_yaml json
);


ALTER TABLE public.rendered_task_instance_fields OWNER TO admin;

--
-- Name: rooms; Type: TABLE; Schema: public; Owner: admin
--

CREATE TABLE public.rooms (
    room_id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid,
    room_number character varying(50) NOT NULL,
    room_type public.room_type_enum NOT NULL,
    status public.room_status_enum DEFAULT 'available'::public.room_status_enum,
    price_per_night numeric(10,2),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    loaded_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.rooms OWNER TO admin;

--
-- Name: serialized_dag; Type: TABLE; Schema: public; Owner: admin
--

CREATE TABLE public.serialized_dag (
    dag_id character varying(250) NOT NULL,
    fileloc character varying(2000) NOT NULL,
    fileloc_hash bigint NOT NULL,
    data json,
    data_compressed bytea,
    last_updated timestamp with time zone NOT NULL,
    dag_hash character varying(32) NOT NULL,
    processor_subdir character varying(2000)
);


ALTER TABLE public.serialized_dag OWNER TO admin;

--
-- Name: session; Type: TABLE; Schema: public; Owner: admin
--

CREATE TABLE public.session (
    id integer NOT NULL,
    session_id character varying(255),
    data bytea,
    expiry timestamp without time zone
);


ALTER TABLE public.session OWNER TO admin;

--
-- Name: session_id_seq; Type: SEQUENCE; Schema: public; Owner: admin
--

CREATE SEQUENCE public.session_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.session_id_seq OWNER TO admin;

--
-- Name: session_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: admin
--

ALTER SEQUENCE public.session_id_seq OWNED BY public.session.id;


--
-- Name: sla_miss; Type: TABLE; Schema: public; Owner: admin
--

CREATE TABLE public.sla_miss (
    task_id character varying(250) NOT NULL,
    dag_id character varying(250) NOT NULL,
    execution_date timestamp with time zone NOT NULL,
    email_sent boolean,
    "timestamp" timestamp with time zone,
    description text,
    notification_sent boolean
);


ALTER TABLE public.sla_miss OWNER TO admin;

--
-- Name: slot_pool; Type: TABLE; Schema: public; Owner: admin
--

CREATE TABLE public.slot_pool (
    id integer NOT NULL,
    pool character varying(256),
    slots integer,
    description text,
    include_deferred boolean NOT NULL
);


ALTER TABLE public.slot_pool OWNER TO admin;

--
-- Name: slot_pool_id_seq; Type: SEQUENCE; Schema: public; Owner: admin
--

CREATE SEQUENCE public.slot_pool_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.slot_pool_id_seq OWNER TO admin;

--
-- Name: slot_pool_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: admin
--

ALTER SEQUENCE public.slot_pool_id_seq OWNED BY public.slot_pool.id;


--
-- Name: task_fail; Type: TABLE; Schema: public; Owner: admin
--

CREATE TABLE public.task_fail (
    id integer NOT NULL,
    task_id character varying(250) NOT NULL,
    dag_id character varying(250) NOT NULL,
    run_id character varying(250) NOT NULL,
    map_index integer DEFAULT '-1'::integer NOT NULL,
    start_date timestamp with time zone,
    end_date timestamp with time zone,
    duration integer
);


ALTER TABLE public.task_fail OWNER TO admin;

--
-- Name: task_fail_id_seq; Type: SEQUENCE; Schema: public; Owner: admin
--

CREATE SEQUENCE public.task_fail_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.task_fail_id_seq OWNER TO admin;

--
-- Name: task_fail_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: admin
--

ALTER SEQUENCE public.task_fail_id_seq OWNED BY public.task_fail.id;


--
-- Name: task_instance; Type: TABLE; Schema: public; Owner: admin
--

CREATE TABLE public.task_instance (
    task_id character varying(250) NOT NULL,
    dag_id character varying(250) NOT NULL,
    run_id character varying(250) NOT NULL,
    map_index integer DEFAULT '-1'::integer NOT NULL,
    start_date timestamp with time zone,
    end_date timestamp with time zone,
    duration double precision,
    state character varying(20),
    try_number integer,
    max_tries integer DEFAULT '-1'::integer,
    hostname character varying(1000),
    unixname character varying(1000),
    job_id integer,
    pool character varying(256) NOT NULL,
    pool_slots integer NOT NULL,
    queue character varying(256),
    priority_weight integer,
    operator character varying(1000),
    custom_operator_name character varying(1000),
    queued_dttm timestamp with time zone,
    queued_by_job_id integer,
    pid integer,
    executor_config bytea,
    updated_at timestamp with time zone,
    external_executor_id character varying(250),
    trigger_id integer,
    trigger_timeout timestamp without time zone,
    next_method character varying(1000),
    next_kwargs json
);


ALTER TABLE public.task_instance OWNER TO admin;

--
-- Name: task_instance_note; Type: TABLE; Schema: public; Owner: admin
--

CREATE TABLE public.task_instance_note (
    user_id integer,
    task_id character varying(250) NOT NULL,
    dag_id character varying(250) NOT NULL,
    run_id character varying(250) NOT NULL,
    map_index integer NOT NULL,
    content character varying(1000),
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);


ALTER TABLE public.task_instance_note OWNER TO admin;

--
-- Name: task_map; Type: TABLE; Schema: public; Owner: admin
--

CREATE TABLE public.task_map (
    dag_id character varying(250) NOT NULL,
    task_id character varying(250) NOT NULL,
    run_id character varying(250) NOT NULL,
    map_index integer NOT NULL,
    length integer NOT NULL,
    keys json,
    CONSTRAINT ck_task_map_task_map_length_not_negative CHECK ((length >= 0))
);


ALTER TABLE public.task_map OWNER TO admin;

--
-- Name: task_outlet_dataset_reference; Type: TABLE; Schema: public; Owner: admin
--

CREATE TABLE public.task_outlet_dataset_reference (
    dataset_id integer NOT NULL,
    dag_id character varying(250) NOT NULL,
    task_id character varying(250) NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);


ALTER TABLE public.task_outlet_dataset_reference OWNER TO admin;

--
-- Name: task_reschedule; Type: TABLE; Schema: public; Owner: admin
--

CREATE TABLE public.task_reschedule (
    id integer NOT NULL,
    task_id character varying(250) NOT NULL,
    dag_id character varying(250) NOT NULL,
    run_id character varying(250) NOT NULL,
    map_index integer DEFAULT '-1'::integer NOT NULL,
    try_number integer NOT NULL,
    start_date timestamp with time zone NOT NULL,
    end_date timestamp with time zone NOT NULL,
    duration integer NOT NULL,
    reschedule_date timestamp with time zone NOT NULL
);


ALTER TABLE public.task_reschedule OWNER TO admin;

--
-- Name: task_reschedule_id_seq; Type: SEQUENCE; Schema: public; Owner: admin
--

CREATE SEQUENCE public.task_reschedule_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.task_reschedule_id_seq OWNER TO admin;

--
-- Name: task_reschedule_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: admin
--

ALTER SEQUENCE public.task_reschedule_id_seq OWNED BY public.task_reschedule.id;


--
-- Name: tenants; Type: TABLE; Schema: public; Owner: admin
--

CREATE TABLE public.tenants (
    tenant_sk integer NOT NULL,
    tenant_id uuid DEFAULT gen_random_uuid(),
    company_name character varying(255),
    timezone character varying(50) DEFAULT 'UTC'::character varying,
    currency character varying(10) DEFAULT 'USD'::character varying,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.tenants OWNER TO admin;

--
-- Name: tenants_tenant_sk_seq; Type: SEQUENCE; Schema: public; Owner: admin
--

CREATE SEQUENCE public.tenants_tenant_sk_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.tenants_tenant_sk_seq OWNER TO admin;

--
-- Name: tenants_tenant_sk_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: admin
--

ALTER SEQUENCE public.tenants_tenant_sk_seq OWNED BY public.tenants.tenant_sk;


--
-- Name: trigger; Type: TABLE; Schema: public; Owner: admin
--

CREATE TABLE public.trigger (
    id integer NOT NULL,
    classpath character varying(1000) NOT NULL,
    kwargs json NOT NULL,
    created_date timestamp with time zone NOT NULL,
    triggerer_id integer
);


ALTER TABLE public.trigger OWNER TO admin;

--
-- Name: trigger_id_seq; Type: SEQUENCE; Schema: public; Owner: admin
--

CREATE SEQUENCE public.trigger_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.trigger_id_seq OWNER TO admin;

--
-- Name: trigger_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: admin
--

ALTER SEQUENCE public.trigger_id_seq OWNED BY public.trigger.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: admin
--

CREATE TABLE public.users (
    user_id integer NOT NULL,
    tenant_id uuid,
    username character varying(100) NOT NULL,
    password_hash character varying(255) NOT NULL,
    role public.user_role_enum NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    loaded_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.users OWNER TO admin;

--
-- Name: users_user_id_seq; Type: SEQUENCE; Schema: public; Owner: admin
--

CREATE SEQUENCE public.users_user_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.users_user_id_seq OWNER TO admin;

--
-- Name: users_user_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: admin
--

ALTER SEQUENCE public.users_user_id_seq OWNED BY public.users.user_id;


--
-- Name: variable; Type: TABLE; Schema: public; Owner: admin
--

CREATE TABLE public.variable (
    id integer NOT NULL,
    key character varying(250),
    val text,
    description text,
    is_encrypted boolean
);


ALTER TABLE public.variable OWNER TO admin;

--
-- Name: variable_id_seq; Type: SEQUENCE; Schema: public; Owner: admin
--

CREATE SEQUENCE public.variable_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.variable_id_seq OWNER TO admin;

--
-- Name: variable_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: admin
--

ALTER SEQUENCE public.variable_id_seq OWNED BY public.variable.id;


--
-- Name: xcom; Type: TABLE; Schema: public; Owner: admin
--

CREATE TABLE public.xcom (
    dag_run_id integer NOT NULL,
    task_id character varying(250) NOT NULL,
    map_index integer DEFAULT '-1'::integer NOT NULL,
    key character varying(512) NOT NULL,
    dag_id character varying(250) NOT NULL,
    run_id character varying(250) NOT NULL,
    value bytea,
    "timestamp" timestamp with time zone NOT NULL
);


ALTER TABLE public.xcom OWNER TO admin;

--
-- Name: my_first_dbt_model; Type: TABLE; Schema: stg; Owner: admin
--

CREATE TABLE stg.my_first_dbt_model (
    id integer
);


ALTER TABLE stg.my_first_dbt_model OWNER TO admin;

--
-- Name: my_second_dbt_model; Type: VIEW; Schema: stg; Owner: admin
--

CREATE VIEW stg.my_second_dbt_model AS
 SELECT my_first_dbt_model.id
   FROM stg.my_first_dbt_model
  WHERE (my_first_dbt_model.id = 1);


ALTER TABLE stg.my_second_dbt_model OWNER TO admin;

--
-- Name: stg_rooms; Type: VIEW; Schema: stg; Owner: admin
--

CREATE VIEW stg.stg_rooms AS
 WITH source AS (
         SELECT rooms.room_id,
            rooms.tenant_id,
            rooms.room_number,
            rooms.room_type,
            rooms.status,
            rooms.price_per_night,
            rooms.created_at,
            rooms.loaded_at
           FROM public.rooms
        )
 SELECT source.room_id,
    source.tenant_id,
    source.room_number,
    source.room_type,
    source.status,
    source.price_per_night,
    source.created_at,
    CURRENT_TIMESTAMP AS dbt_loaded_at
   FROM source;


ALTER TABLE stg.stg_rooms OWNER TO admin;

--
-- Name: ab_permission id; Type: DEFAULT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.ab_permission ALTER COLUMN id SET DEFAULT nextval('public.ab_permission_id_seq'::regclass);


--
-- Name: ab_permission_view id; Type: DEFAULT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.ab_permission_view ALTER COLUMN id SET DEFAULT nextval('public.ab_permission_view_id_seq'::regclass);


--
-- Name: ab_permission_view_role id; Type: DEFAULT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.ab_permission_view_role ALTER COLUMN id SET DEFAULT nextval('public.ab_permission_view_role_id_seq'::regclass);


--
-- Name: ab_register_user id; Type: DEFAULT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.ab_register_user ALTER COLUMN id SET DEFAULT nextval('public.ab_register_user_id_seq'::regclass);


--
-- Name: ab_role id; Type: DEFAULT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.ab_role ALTER COLUMN id SET DEFAULT nextval('public.ab_role_id_seq'::regclass);


--
-- Name: ab_user id; Type: DEFAULT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.ab_user ALTER COLUMN id SET DEFAULT nextval('public.ab_user_id_seq'::regclass);


--
-- Name: ab_user_role id; Type: DEFAULT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.ab_user_role ALTER COLUMN id SET DEFAULT nextval('public.ab_user_role_id_seq'::regclass);


--
-- Name: ab_view_menu id; Type: DEFAULT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.ab_view_menu ALTER COLUMN id SET DEFAULT nextval('public.ab_view_menu_id_seq'::regclass);


--
-- Name: callback_request id; Type: DEFAULT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.callback_request ALTER COLUMN id SET DEFAULT nextval('public.callback_request_id_seq'::regclass);


--
-- Name: connection id; Type: DEFAULT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.connection ALTER COLUMN id SET DEFAULT nextval('public.connection_id_seq'::regclass);


--
-- Name: dag_pickle id; Type: DEFAULT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.dag_pickle ALTER COLUMN id SET DEFAULT nextval('public.dag_pickle_id_seq'::regclass);


--
-- Name: dag_run id; Type: DEFAULT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.dag_run ALTER COLUMN id SET DEFAULT nextval('public.dag_run_id_seq'::regclass);


--
-- Name: dataset id; Type: DEFAULT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.dataset ALTER COLUMN id SET DEFAULT nextval('public.dataset_id_seq'::regclass);


--
-- Name: dataset_event id; Type: DEFAULT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.dataset_event ALTER COLUMN id SET DEFAULT nextval('public.dataset_event_id_seq'::regclass);


--
-- Name: import_error id; Type: DEFAULT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.import_error ALTER COLUMN id SET DEFAULT nextval('public.import_error_id_seq'::regclass);


--
-- Name: job id; Type: DEFAULT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.job ALTER COLUMN id SET DEFAULT nextval('public.job_id_seq'::regclass);


--
-- Name: log id; Type: DEFAULT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.log ALTER COLUMN id SET DEFAULT nextval('public.log_id_seq'::regclass);


--
-- Name: log_template id; Type: DEFAULT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.log_template ALTER COLUMN id SET DEFAULT nextval('public.log_template_id_seq'::regclass);


--
-- Name: session id; Type: DEFAULT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.session ALTER COLUMN id SET DEFAULT nextval('public.session_id_seq'::regclass);


--
-- Name: slot_pool id; Type: DEFAULT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.slot_pool ALTER COLUMN id SET DEFAULT nextval('public.slot_pool_id_seq'::regclass);


--
-- Name: task_fail id; Type: DEFAULT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.task_fail ALTER COLUMN id SET DEFAULT nextval('public.task_fail_id_seq'::regclass);


--
-- Name: task_reschedule id; Type: DEFAULT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.task_reschedule ALTER COLUMN id SET DEFAULT nextval('public.task_reschedule_id_seq'::regclass);


--
-- Name: tenants tenant_sk; Type: DEFAULT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.tenants ALTER COLUMN tenant_sk SET DEFAULT nextval('public.tenants_tenant_sk_seq'::regclass);


--
-- Name: trigger id; Type: DEFAULT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.trigger ALTER COLUMN id SET DEFAULT nextval('public.trigger_id_seq'::regclass);


--
-- Name: users user_id; Type: DEFAULT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.users ALTER COLUMN user_id SET DEFAULT nextval('public.users_user_id_seq'::regclass);


--
-- Name: variable id; Type: DEFAULT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.variable ALTER COLUMN id SET DEFAULT nextval('public.variable_id_seq'::regclass);


--
-- Data for Name: ab_permission; Type: TABLE DATA; Schema: public; Owner: admin
--

COPY public.ab_permission (id, name) FROM stdin;
1	can_edit
2	can_read
3	can_create
4	can_delete
5	menu_access
6	muldelete
7	mulemailsent
8	mulemailsentfalse
9	mulnotificationsent
10	mulnotificationsentfalse
\.


--
-- Data for Name: ab_permission_view; Type: TABLE DATA; Schema: public; Owner: admin
--

COPY public.ab_permission_view (id, permission_id, view_menu_id) FROM stdin;
1	1	4
2	2	4
3	1	5
4	2	5
5	1	6
6	2	6
7	3	8
8	2	8
9	1	8
10	4	8
11	5	9
12	5	10
13	3	11
14	2	11
15	1	11
16	4	11
17	5	12
18	2	13
19	5	14
20	2	15
21	5	16
22	2	17
23	5	18
24	2	19
25	5	20
26	3	23
27	2	23
28	1	23
29	4	23
30	5	23
31	5	24
32	2	25
33	5	25
34	2	26
35	5	26
36	3	27
37	2	27
38	1	27
39	4	27
40	5	27
41	5	28
42	3	29
43	2	29
44	1	29
45	4	29
46	5	29
47	2	30
48	5	30
49	2	31
50	5	31
51	2	32
52	5	32
53	3	33
54	2	33
55	1	33
56	4	33
57	5	33
58	2	34
59	5	34
60	6	34
61	7	34
62	8	34
63	9	34
64	10	34
65	2	35
66	5	35
67	2	36
68	5	36
69	3	37
70	2	37
71	1	37
72	4	37
73	5	37
74	3	38
75	2	38
76	4	38
77	5	38
78	5	40
79	5	42
80	5	43
81	5	44
82	5	45
83	5	46
84	2	42
85	1	42
86	4	42
87	2	44
88	2	47
89	2	48
90	2	49
91	2	40
92	2	43
93	2	50
94	2	51
\.


--
-- Data for Name: ab_permission_view_role; Type: TABLE DATA; Schema: public; Owner: admin
--

COPY public.ab_permission_view_role (id, permission_view_id, role_id) FROM stdin;
1	1	1
2	2	1
3	3	1
4	4	1
5	5	1
6	6	1
7	7	1
8	8	1
9	9	1
10	10	1
11	11	1
12	12	1
13	13	1
14	14	1
15	15	1
16	16	1
17	17	1
18	18	1
19	19	1
20	20	1
21	21	1
22	22	1
23	23	1
24	24	1
25	25	1
26	26	1
27	27	1
28	28	1
29	29	1
30	30	1
31	31	1
32	32	1
33	33	1
34	34	1
35	35	1
36	36	1
37	37	1
38	38	1
39	39	1
40	40	1
41	41	1
42	42	1
43	43	1
44	44	1
45	45	1
46	46	1
47	47	1
48	48	1
49	49	1
50	50	1
51	51	1
52	52	1
53	53	1
54	54	1
55	55	1
56	56	1
57	57	1
58	58	1
59	59	1
60	60	1
61	61	1
62	62	1
63	63	1
64	64	1
65	65	1
66	66	1
67	67	1
68	68	1
69	69	1
70	70	1
71	71	1
72	72	1
73	73	1
74	74	1
75	75	1
76	76	1
77	77	1
78	78	1
79	79	1
80	80	1
81	81	1
82	82	1
83	83	1
84	34	3
85	84	3
86	91	3
87	89	3
88	27	3
89	87	3
90	92	3
91	88	3
92	90	3
93	32	3
94	4	3
95	3	3
96	6	3
97	5	3
98	65	3
99	58	3
100	43	3
101	93	3
102	75	3
103	94	3
104	31	3
105	79	3
106	78	3
107	30	3
108	81	3
109	80	3
110	82	3
111	83	3
112	33	3
113	35	3
114	66	3
115	59	3
116	46	3
117	34	4
118	84	4
119	91	4
120	89	4
121	27	4
122	87	4
123	92	4
124	88	4
125	90	4
126	32	4
127	4	4
128	3	4
129	6	4
130	5	4
131	65	4
132	58	4
133	43	4
134	93	4
135	75	4
136	94	4
137	31	4
138	79	4
139	78	4
140	30	4
141	81	4
142	80	4
143	82	4
144	83	4
145	33	4
146	35	4
147	66	4
148	59	4
149	46	4
150	85	4
151	86	4
152	42	4
153	44	4
154	45	4
155	26	4
156	28	4
157	29	4
158	34	5
159	84	5
160	91	5
161	89	5
162	27	5
163	87	5
164	92	5
165	88	5
166	90	5
167	32	5
168	4	5
169	3	5
170	6	5
171	5	5
172	65	5
173	58	5
174	43	5
175	93	5
176	75	5
177	94	5
178	31	5
179	79	5
180	78	5
181	30	5
182	81	5
183	80	5
184	82	5
185	83	5
186	33	5
187	35	5
188	66	5
189	59	5
190	46	5
191	85	5
192	86	5
193	42	5
194	44	5
195	45	5
196	26	5
197	28	5
198	29	5
199	51	5
200	41	5
201	52	5
202	57	5
203	73	5
204	40	5
205	77	5
206	53	5
207	54	5
208	55	5
209	56	5
210	69	5
211	70	5
212	71	5
213	72	5
214	67	5
215	36	5
216	37	5
217	38	5
218	39	5
219	76	5
220	84	1
221	91	1
222	89	1
223	87	1
224	92	1
225	88	1
226	90	1
227	93	1
228	94	1
229	85	1
230	86	1
\.


--
-- Data for Name: ab_register_user; Type: TABLE DATA; Schema: public; Owner: admin
--

COPY public.ab_register_user (id, first_name, last_name, username, password, email, registration_date, registration_hash) FROM stdin;
\.


--
-- Data for Name: ab_role; Type: TABLE DATA; Schema: public; Owner: admin
--

COPY public.ab_role (id, name) FROM stdin;
1	Admin
2	Public
3	Viewer
4	User
5	Op
\.


--
-- Data for Name: ab_user; Type: TABLE DATA; Schema: public; Owner: admin
--

COPY public.ab_user (id, first_name, last_name, username, password, active, email, last_login, login_count, fail_login_count, created_on, changed_on, created_by_fk, changed_by_fk) FROM stdin;
3	Admin	NextStay	admin	pbkdf2:sha256:260000$H3soxTzj8zH3ctLB$eaf0556ac26f49e719c067ec39b87731ed6af8be8377e74d4710d6db7eeffd40	t	admin@nextstay.com	2026-01-25 12:33:20.740019	1	0	2026-01-25 12:31:34.336019	2026-01-25 12:31:34.336024	\N	\N
\.


--
-- Data for Name: ab_user_role; Type: TABLE DATA; Schema: public; Owner: admin
--

COPY public.ab_user_role (id, user_id, role_id) FROM stdin;
3	3	1
\.


--
-- Data for Name: ab_view_menu; Type: TABLE DATA; Schema: public; Owner: admin
--

COPY public.ab_view_menu (id, name) FROM stdin;
1	IndexView
2	UtilView
3	LocaleView
4	Passwords
5	My Password
6	My Profile
7	AuthDBView
8	Users
9	List Users
10	Security
11	Roles
12	List Roles
13	User Stats Chart
14	User's Statistics
15	Permissions
16	Actions
17	View Menus
18	Resources
19	Permission Views
20	Permission Pairs
21	AutocompleteView
22	Airflow
23	DAG Runs
24	Browse
25	Jobs
26	Audit Logs
27	Variables
28	Admin
29	Task Instances
30	Task Reschedules
31	Triggers
32	Configurations
33	Connections
34	SLA Misses
35	Plugins
36	Providers
37	Pools
38	XComs
39	DagDependenciesView
40	DAG Dependencies
41	RedocView
42	DAGs
43	Cluster Activity
44	Datasets
45	Documentation
46	Docs
47	ImportError
48	DAG Code
49	DAG Warnings
50	Task Logs
51	Website
\.


--
-- Data for Name: alembic_version; Type: TABLE DATA; Schema: public; Owner: admin
--

COPY public.alembic_version (version_num) FROM stdin;
405de8318b3a
\.


--
-- Data for Name: bookings; Type: TABLE DATA; Schema: public; Owner: admin
--

COPY public.bookings (booking_id, tenant_id, room_id, client_id, check_in, check_out, total_price, status, created_at, loaded_at) FROM stdin;
50f801a5-a296-467c-b64d-8ba7bcbc816b	b66abf98-6067-4495-b123-4be3af572604	163f2d1c-e1aa-41ba-b7b1-3c23067e1f1a	1d1d6a6d-7524-43d1-9b20-dbdd0ab386fa	2026-01-27 12:11:44.723802	2026-01-28 12:11:44.723802	160.00	confirmed	2026-01-25 11:11:44.71822	2026-01-25 11:11:44.71822
\.


--
-- Data for Name: callback_request; Type: TABLE DATA; Schema: public; Owner: admin
--

COPY public.callback_request (id, created_at, priority_weight, callback_data, callback_type, processor_subdir) FROM stdin;
\.


--
-- Data for Name: cleaning_tasks; Type: TABLE DATA; Schema: public; Owner: admin
--

COPY public.cleaning_tasks (task_id, tenant_id, room_id, assigned_to, status, created_at, finished_at, loaded_at) FROM stdin;
\.


--
-- Data for Name: clients; Type: TABLE DATA; Schema: public; Owner: admin
--

COPY public.clients (client_id, tenant_id, first_name, last_name, email, phone, created_at, loaded_at) FROM stdin;
1d1d6a6d-7524-43d1-9b20-dbdd0ab386fa	b66abf98-6067-4495-b123-4be3af572604	Guest_98	\N	test@mail.com	\N	2026-01-25 11:11:44.71822	2026-01-25 11:11:44.71822
\.


--
-- Data for Name: connection; Type: TABLE DATA; Schema: public; Owner: admin
--

COPY public.connection (id, conn_id, conn_type, description, host, schema, login, password, port, is_encrypted, is_extra_encrypted, extra) FROM stdin;
1	airflow_db	mysql	\N	mysql	airflow	root	\N	\N	f	f	\N
2	aws_default	aws	\N	\N	\N	\N	\N	\N	f	f	\N
3	azure_batch_default	azure_batch	\N	\N	\N	<ACCOUNT_NAME>	\N	\N	f	f	{"account_url": "<ACCOUNT_URL>"}
4	azure_cosmos_default	azure_cosmos	\N	\N	\N	\N	\N	\N	f	f	{"database_name": "<DATABASE_NAME>", "collection_name": "<COLLECTION_NAME>" }
5	azure_data_explorer_default	azure_data_explorer	\N	https://<CLUSTER>.kusto.windows.net	\N	\N	\N	\N	f	f	{"auth_method": "<AAD_APP | AAD_APP_CERT | AAD_CREDS | AAD_DEVICE>",\n                    "tenant": "<TENANT ID>", "certificate": "<APPLICATION PEM CERTIFICATE>",\n                    "thumbprint": "<APPLICATION CERTIFICATE THUMBPRINT>"}
6	azure_data_lake_default	azure_data_lake	\N	\N	\N	\N	\N	\N	f	f	{"tenant": "<TENANT>", "account_name": "<ACCOUNTNAME>" }
7	azure_default	azure	\N	\N	\N	\N	\N	\N	f	f	\N
8	cassandra_default	cassandra	\N	cassandra	\N	\N	\N	9042	f	f	\N
9	databricks_default	databricks	\N	localhost	\N	\N	\N	\N	f	f	\N
10	dingding_default	http	\N		\N	\N	\N	\N	f	f	\N
11	drill_default	drill	\N	localhost	\N	\N	\N	8047	f	f	{"dialect_driver": "drill+sadrill", "storage_plugin": "dfs"}
12	druid_broker_default	druid	\N	druid-broker	\N	\N	\N	8082	f	f	{"endpoint": "druid/v2/sql"}
13	druid_ingest_default	druid	\N	druid-overlord	\N	\N	\N	8081	f	f	{"endpoint": "druid/indexer/v1/task"}
14	elasticsearch_default	elasticsearch	\N	localhost	http	\N	\N	9200	f	f	\N
15	emr_default	emr	\N	\N	\N	\N	\N	\N	f	f	\n                {   "Name": "default_job_flow_name",\n                    "LogUri": "s3://my-emr-log-bucket/default_job_flow_location",\n                    "ReleaseLabel": "emr-4.6.0",\n                    "Instances": {\n                        "Ec2KeyName": "mykey",\n                        "Ec2SubnetId": "somesubnet",\n                        "InstanceGroups": [\n                            {\n                                "Name": "Master nodes",\n                                "Market": "ON_DEMAND",\n                                "InstanceRole": "MASTER",\n                                "InstanceType": "r3.2xlarge",\n                                "InstanceCount": 1\n                            },\n                            {\n                                "Name": "Core nodes",\n                                "Market": "ON_DEMAND",\n                                "InstanceRole": "CORE",\n                                "InstanceType": "r3.2xlarge",\n                                "InstanceCount": 1\n                            }\n                        ],\n                        "TerminationProtected": false,\n                        "KeepJobFlowAliveWhenNoSteps": false\n                    },\n                    "Applications":[\n                        { "Name": "Spark" }\n                    ],\n                    "VisibleToAllUsers": true,\n                    "JobFlowRole": "EMR_EC2_DefaultRole",\n                    "ServiceRole": "EMR_DefaultRole",\n                    "Tags": [\n                        {\n                            "Key": "app",\n                            "Value": "analytics"\n                        },\n                        {\n                            "Key": "environment",\n                            "Value": "development"\n                        }\n                    ]\n                }\n            
16	facebook_default	facebook_social	\N	\N	\N	\N	\N	\N	f	f	\n                {   "account_id": "<AD_ACCOUNT_ID>",\n                    "app_id": "<FACEBOOK_APP_ID>",\n                    "app_secret": "<FACEBOOK_APP_SECRET>",\n                    "access_token": "<FACEBOOK_AD_ACCESS_TOKEN>"\n                }\n            
17	fs_default	fs	\N	\N	\N	\N	\N	\N	f	f	{"path": "/"}
18	ftp_default	ftp	\N	localhost	\N	airflow	airflow	21	f	f	{"key_file": "~/.ssh/id_rsa", "no_host_key_check": true}
19	google_cloud_default	google_cloud_platform	\N	\N	default	\N	\N	\N	f	f	\N
20	hive_cli_default	hive_cli	\N	localhost	default	\N	\N	10000	f	f	{"use_beeline": true, "auth": ""}
21	hiveserver2_default	hiveserver2	\N	localhost	default	\N	\N	10000	f	f	\N
22	http_default	http	\N	https://www.httpbin.org/	\N	\N	\N	\N	f	f	\N
23	impala_default	impala	\N	localhost	\N	\N	\N	21050	f	f	\N
24	kafka_default	kafka	\N	\N	\N	\N	\N	\N	f	f	{"bootstrap.servers": "broker:29092"}
25	kubernetes_default	kubernetes	\N	\N	\N	\N	\N	\N	f	f	\N
26	kylin_default	kylin	\N	localhost	\N	ADMIN	KYLIN	7070	f	f	\N
27	leveldb_default	leveldb	\N	localhost	\N	\N	\N	\N	f	f	\N
28	livy_default	livy	\N	livy	\N	\N	\N	8998	f	f	\N
29	local_mysql	mysql	\N	localhost	airflow	airflow	airflow	\N	f	f	\N
30	metastore_default	hive_metastore	\N	localhost	\N	\N	\N	9083	f	f	{"authMechanism": "PLAIN"}
31	mongo_default	mongo	\N	mongo	\N	\N	\N	27017	f	f	\N
32	mssql_default	mssql	\N	localhost	\N	\N	\N	1433	f	f	\N
33	mysql_default	mysql	\N	mysql	airflow	root	\N	\N	f	f	\N
34	opsgenie_default	http	\N		\N	\N	\N	\N	f	f	\N
35	oracle_default	oracle	\N	localhost	schema	root	password	1521	f	f	\N
36	oss_default	oss	\N	\N	\N	\N	\N	\N	f	f	{\n                "auth_type": "AK",\n                "access_key_id": "<ACCESS_KEY_ID>",\n                "access_key_secret": "<ACCESS_KEY_SECRET>",\n                "region": "<YOUR_OSS_REGION>"}\n                
37	pig_cli_default	pig_cli	\N	\N	default	\N	\N	\N	f	f	\N
38	pinot_admin_default	pinot	\N	localhost	\N	\N	\N	9000	f	f	\N
39	pinot_broker_default	pinot	\N	localhost	\N	\N	\N	9000	f	f	{"endpoint": "/query", "schema": "http"}
40	postgres_default	postgres	\N	postgres	airflow	postgres	airflow	\N	f	f	\N
41	presto_default	presto	\N	localhost	hive	\N	\N	3400	f	f	\N
42	qubole_default	qubole	\N	localhost	\N	\N	\N	\N	f	f	\N
43	redis_default	redis	\N	redis	\N	\N	\N	6379	f	f	{"db": 0}
44	redshift_default	redshift	\N	\N	\N	\N	\N	\N	f	f	{\n    "iam": true,\n    "cluster_identifier": "<REDSHIFT_CLUSTER_IDENTIFIER>",\n    "port": 5439,\n    "profile": "default",\n    "db_user": "awsuser",\n    "database": "dev",\n    "region": ""\n}
45	salesforce_default	salesforce	\N	\N	\N	username	password	\N	f	f	{"security_token": "security_token"}
46	segment_default	segment	\N	\N	\N	\N	\N	\N	f	f	{"write_key": "my-segment-write-key"}
47	sftp_default	sftp	\N	localhost	\N	airflow	\N	22	f	f	{"key_file": "~/.ssh/id_rsa", "no_host_key_check": true}
48	spark_default	spark	\N	yarn	\N	\N	\N	\N	f	f	{"queue": "root.default"}
49	sqlite_default	sqlite	\N	/tmp/sqlite_default.db	\N	\N	\N	\N	f	f	\N
50	sqoop_default	sqoop	\N	rdbms	\N	\N	\N	\N	f	f	\N
51	ssh_default	ssh	\N	localhost	\N	\N	\N	\N	f	f	\N
52	tableau_default	tableau	\N	https://tableau.server.url	\N	user	password	\N	f	f	{"site_id": "my_site"}
53	tabular_default	tabular	\N	https://api.tabulardata.io/ws/v1	\N	\N	\N	\N	f	f	\N
54	trino_default	trino	\N	localhost	hive	\N	\N	3400	f	f	\N
55	vertica_default	vertica	\N	localhost	\N	\N	\N	5433	f	f	\N
56	wasb_default	wasb	\N	\N	\N	\N	\N	\N	f	f	{"sas_token": null}
58	yandexcloud_default	yandexcloud	\N	\N	default	\N	\N	\N	f	f	\N
57	webhdfs_default	hdfs	\N	localhost	\N	\N	\N	50070	f	f	\N
\.


--
-- Data for Name: dag; Type: TABLE DATA; Schema: public; Owner: admin
--

COPY public.dag (dag_id, root_dag_id, is_paused, is_subdag, is_active, last_parsed_time, last_pickled, last_expired, scheduler_lock, pickle_id, fileloc, processor_subdir, owners, description, default_view, schedule_interval, timetable_description, max_active_tasks, max_active_runs, has_task_concurrency_limits, has_import_errors, next_dagrun, next_dagrun_data_interval_start, next_dagrun_data_interval_end, next_dagrun_create_after) FROM stdin;
\.


--
-- Data for Name: dag_code; Type: TABLE DATA; Schema: public; Owner: admin
--

COPY public.dag_code (fileloc_hash, fileloc, last_updated, source_code) FROM stdin;
\.


--
-- Data for Name: dag_owner_attributes; Type: TABLE DATA; Schema: public; Owner: admin
--

COPY public.dag_owner_attributes (dag_id, owner, link) FROM stdin;
\.


--
-- Data for Name: dag_pickle; Type: TABLE DATA; Schema: public; Owner: admin
--

COPY public.dag_pickle (id, pickle, created_dttm, pickle_hash) FROM stdin;
\.


--
-- Data for Name: dag_run; Type: TABLE DATA; Schema: public; Owner: admin
--

COPY public.dag_run (id, dag_id, queued_at, execution_date, start_date, end_date, state, run_id, creating_job_id, external_trigger, run_type, conf, data_interval_start, data_interval_end, last_scheduling_decision, dag_hash, log_template_id, updated_at) FROM stdin;
\.


--
-- Data for Name: dag_run_note; Type: TABLE DATA; Schema: public; Owner: admin
--

COPY public.dag_run_note (user_id, dag_run_id, content, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: dag_schedule_dataset_reference; Type: TABLE DATA; Schema: public; Owner: admin
--

COPY public.dag_schedule_dataset_reference (dataset_id, dag_id, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: dag_tag; Type: TABLE DATA; Schema: public; Owner: admin
--

COPY public.dag_tag (name, dag_id) FROM stdin;
\.


--
-- Data for Name: dag_warning; Type: TABLE DATA; Schema: public; Owner: admin
--

COPY public.dag_warning (dag_id, warning_type, message, "timestamp") FROM stdin;
\.


--
-- Data for Name: dagrun_dataset_event; Type: TABLE DATA; Schema: public; Owner: admin
--

COPY public.dagrun_dataset_event (dag_run_id, event_id) FROM stdin;
\.


--
-- Data for Name: dataset; Type: TABLE DATA; Schema: public; Owner: admin
--

COPY public.dataset (id, uri, extra, created_at, updated_at, is_orphaned) FROM stdin;
\.


--
-- Data for Name: dataset_dag_run_queue; Type: TABLE DATA; Schema: public; Owner: admin
--

COPY public.dataset_dag_run_queue (dataset_id, target_dag_id, created_at) FROM stdin;
\.


--
-- Data for Name: dataset_event; Type: TABLE DATA; Schema: public; Owner: admin
--

COPY public.dataset_event (id, dataset_id, extra, source_task_id, source_dag_id, source_run_id, source_map_index, "timestamp") FROM stdin;
\.


--
-- Data for Name: import_error; Type: TABLE DATA; Schema: public; Owner: admin
--

COPY public.import_error (id, "timestamp", filename, stacktrace) FROM stdin;
\.


--
-- Data for Name: job; Type: TABLE DATA; Schema: public; Owner: admin
--

COPY public.job (id, dag_id, state, job_type, start_date, end_date, latest_heartbeat, executor_class, hostname, unixname) FROM stdin;
2	\N	running	TriggererJob	2026-01-25 11:10:50.946653+00	\N	2026-01-25 11:38:07.91086+00	\N	e3c48f8efdc1	airflow
1	\N	failed	SchedulerJob	2026-01-25 11:10:49.886478+00	\N	2026-01-25 11:38:06.112747+00	\N	e3c48f8efdc1	airflow
4	\N	running	TriggererJob	2026-01-25 11:38:49.269968+00	\N	2026-01-25 12:36:42.690031+00	\N	cf53266eae06	airflow
3	\N	failed	SchedulerJob	2026-01-25 11:38:48.081905+00	\N	2026-01-25 12:36:41.303031+00	\N	cf53266eae06	airflow
5	\N	running	SchedulerJob	2026-01-26 10:22:03.656149+00	\N	2026-01-26 10:23:04.374948+00	\N	cf53266eae06	airflow
6	\N	running	TriggererJob	2026-01-26 10:22:04.356205+00	\N	2026-01-26 10:23:05.47164+00	\N	cf53266eae06	airflow
\.


--
-- Data for Name: log; Type: TABLE DATA; Schema: public; Owner: admin
--

COPY public.log (id, dttm, dag_id, task_id, map_index, event, execution_date, owner, extra) FROM stdin;
1	2026-01-25 11:10:48.979391+00	\N	\N	\N	cli_webserver	\N	airflow	{"host_name": "e3c48f8efdc1", "full_command": "['/home/airflow/.local/bin/airflow', 'webserver']"}
2	2026-01-25 11:10:49.188861+00	\N	\N	\N	cli_triggerer	\N	airflow	{"host_name": "e3c48f8efdc1", "full_command": "['/home/airflow/.local/bin/airflow', 'triggerer']"}
3	2026-01-25 11:10:49.213269+00	\N	\N	\N	cli_scheduler	\N	airflow	{"host_name": "e3c48f8efdc1", "full_command": "['/home/airflow/.local/bin/airflow', 'scheduler']"}
4	2026-01-25 11:34:29.727932+00	\N	\N	\N	cli_users_create	\N	airflow	{"host_name": "e3c48f8efdc1", "full_command": "['/home/airflow/.local/bin/airflow', 'users', 'create', '--username', 'admin', '--password', '********', '--firstname', 'ataika', '--lastname', 'nextstay', '--role', 'Admin', '--email', 'admin@example.com']"}
5	2026-01-25 11:35:51.809131+00	\N	\N	\N	cli_users_delete	\N	airflow	{"host_name": "e3c48f8efdc1", "full_command": "['/home/airflow/.local/bin/airflow', 'users', 'delete', '--username', 'admin']"}
6	2026-01-25 11:35:54.057011+00	\N	\N	\N	cli_users_create	\N	airflow	{"host_name": "e3c48f8efdc1", "full_command": "['/home/airflow/.local/bin/airflow', 'users', 'create', '--username', 'admin', '--password', '********', '--firstname', 'ataika', '--lastname', 'nextstay', '--role', 'Admin', '--email', 'admin@example.com']"}
7	2026-01-25 11:38:42.253731+00	\N	\N	\N	cli_check	\N	airflow	{"host_name": "cf53266eae06", "full_command": "['/home/airflow/.local/bin/airflow', 'db', 'check']"}
8	2026-01-25 11:38:46.911052+00	\N	\N	\N	cli_webserver	\N	airflow	{"host_name": "cf53266eae06", "full_command": "['/home/airflow/.local/bin/airflow', 'webserver']"}
9	2026-01-25 11:38:47.109583+00	\N	\N	\N	cli_triggerer	\N	airflow	{"host_name": "cf53266eae06", "full_command": "['/home/airflow/.local/bin/airflow', 'triggerer']"}
10	2026-01-25 11:38:47.125282+00	\N	\N	\N	cli_scheduler	\N	airflow	{"host_name": "cf53266eae06", "full_command": "['/home/airflow/.local/bin/airflow', 'scheduler']"}
11	2026-01-25 12:16:55.745695+00	\N	\N	\N	cli_users_create	\N	airflow	{"host_name": "cf53266eae06", "full_command": "['/home/airflow/.local/bin/airflow', 'users', 'create', '--username', 'admin', '--password', '********', '--firstname', 'Admin', '--lastname', 'NextStay', '--role', 'Admin', '--email', 'admin@nextstay.com']"}
12	2026-01-25 12:31:31.227641+00	\N	\N	\N	cli_users_delete	\N	airflow	{"host_name": "cf53266eae06", "full_command": "['/home/airflow/.local/bin/airflow', 'users', 'delete', '--username', 'admin']"}
13	2026-01-25 12:31:33.360365+00	\N	\N	\N	cli_users_create	\N	airflow	{"host_name": "cf53266eae06", "full_command": "['/home/airflow/.local/bin/airflow', 'users', 'create', '--username', 'admin', '--password', '********', '--firstname', 'Admin', '--lastname', 'NextStay', '--role', 'Admin', '--email', 'admin@nextstay.com']"}
14	2026-01-26 10:21:59.604248+00	\N	\N	\N	cli_check	\N	airflow	{"host_name": "cf53266eae06", "full_command": "['/home/airflow/.local/bin/airflow', 'db', 'check']"}
15	2026-01-26 10:22:02.745651+00	\N	\N	\N	cli_webserver	\N	airflow	{"host_name": "cf53266eae06", "full_command": "['/home/airflow/.local/bin/airflow', 'webserver']"}
16	2026-01-26 10:22:02.945341+00	\N	\N	\N	cli_triggerer	\N	airflow	{"host_name": "cf53266eae06", "full_command": "['/home/airflow/.local/bin/airflow', 'triggerer']"}
17	2026-01-26 10:22:02.966299+00	\N	\N	\N	cli_scheduler	\N	airflow	{"host_name": "cf53266eae06", "full_command": "['/home/airflow/.local/bin/airflow', 'scheduler']"}
\.


--
-- Data for Name: log_template; Type: TABLE DATA; Schema: public; Owner: admin
--

COPY public.log_template (id, filename, elasticsearch_id, created_at) FROM stdin;
1	{{ ti.dag_id }}/{{ ti.task_id }}/{{ ts }}/{{ try_number }}.log	{dag_id}-{task_id}-{execution_date}-{try_number}	2026-01-25 11:10:47.380614+00
2	dag_id={{ ti.dag_id }}/run_id={{ ti.run_id }}/task_id={{ ti.task_id }}/{% if ti.map_index >= 0 %}map_index={{ ti.map_index }}/{% endif %}attempt={{ try_number }}.log	{dag_id}-{task_id}-{run_id}-{map_index}-{try_number}	2026-01-25 11:10:47.380621+00
\.


--
-- Data for Name: rendered_task_instance_fields; Type: TABLE DATA; Schema: public; Owner: admin
--

COPY public.rendered_task_instance_fields (dag_id, task_id, run_id, map_index, rendered_fields, k8s_pod_yaml) FROM stdin;
\.


--
-- Data for Name: rooms; Type: TABLE DATA; Schema: public; Owner: admin
--

COPY public.rooms (room_id, tenant_id, room_number, room_type, status, price_per_night, created_at, loaded_at) FROM stdin;
163f2d1c-e1aa-41ba-b7b1-3c23067e1f1a	b66abf98-6067-4495-b123-4be3af572604	101	standard	available	80.00	2026-01-18 18:07:59.229409	2026-01-18 18:07:59.229409
47c9cff4-f948-4003-9a52-a4bd414848e0	b66abf98-6067-4495-b123-4be3af572604	202	deluxe	available	150.00	2026-01-18 18:07:59.229409	2026-01-18 18:07:59.229409
\.


--
-- Data for Name: serialized_dag; Type: TABLE DATA; Schema: public; Owner: admin
--

COPY public.serialized_dag (dag_id, fileloc, fileloc_hash, data, data_compressed, last_updated, dag_hash, processor_subdir) FROM stdin;
\.


--
-- Data for Name: session; Type: TABLE DATA; Schema: public; Owner: admin
--

COPY public.session (id, session_id, data, expiry) FROM stdin;
1	15f62205-2ebf-453c-9289-ee132e53e43a	\\x80049563000000000000007d94288c0a5f7065726d616e656e7494888c065f667265736894898c0a637372665f746f6b656e948c2831643336396566356439346430316330653462313538303864316165373638643833353239316339948c066c6f63616c65948c02656e94752e	2026-02-24 11:34:48.187591
14	f4db2f0a-9483-4d35-bcd0-2941f906b2b0	\\x80049513010000000000007d94288c0a5f7065726d616e656e7494888c065f667265736894888c0a637372665f746f6b656e948c2863386631356139303763396137363533653965346235353963653736653065306133353464386238948c066c6f63616c65948c02656e948c085f757365725f6964944b038c035f6964948c803263373034343537343834353235363938313636303038653363653831663161383632666566613930316665363164643432653137353066333130363733383462363362303831383331663239383935373466356331343663616364386237386438656663373635386363336565316437323664633562313337376566316234948c116461675f7374617475735f66696c746572948c03616c6c94752e	2026-02-24 12:33:21.1656
4	e05e8c8a-acd6-4bdb-80dc-5f5c29601f2d	\\x8004954d010000000000007d94288c0a5f7065726d616e656e7494888c065f667265736894888c0a637372665f746f6b656e948c2866636538326364663466623330333536623036616130313262613965653765323562383430633830948c066c6f63616c65948c02656e948c085f757365725f6964944b028c035f6964948c803932316366323632386239356565376535303861373264663139333339343263663361626534663535386537633966333463663563393737316132646132333437303666376661316461623765623032616335353839643536623730366562613766323431333933656532643030653931336233396162626330663433343238948c116461675f7374617475735f66696c746572948c03616c6c948c0c706167655f686973746f7279945d948c25687474703a2f2f6c6f63616c686f73743a383038302f75736572732f75736572696e666f2f9461752e	2026-02-24 11:36:52.190631
6	14fcdb01-fdca-4dda-8d2f-4aa5ab66e51a	\\x80049563000000000000007d94288c0a5f7065726d616e656e7494888c065f667265736894898c0a637372665f746f6b656e948c2831666637653937656432653966383733663062326536356563306535303232303435363735346239948c066c6f63616c65948c02656e94752e	2026-02-24 11:40:28.123777
7	a9e993c3-f0c9-4ee2-b689-d9ffba9f32a4	\\x80049513010000000000007d94288c0a5f7065726d616e656e7494888c065f667265736894888c0a637372665f746f6b656e948c2831666637653937656432653966383733663062326536356563306535303232303435363735346239948c066c6f63616c65948c02656e948c085f757365725f6964944b028c035f6964948c803932316366323632386239356565376535303861373264663139333339343263663361626534663535386537633966333463663563393737316132646132333437303666376661316461623765623032616335353839643536623730366562613766323431333933656532643030653931336233396162626330663433343238948c116461675f7374617475735f66696c746572948c03616c6c94752e	2026-02-24 11:40:30.552359
5	5d090b5f-e75a-47e0-89e4-5a55aaa14d24	\\x80049563000000000000007d94288c0a5f7065726d616e656e7494888c065f667265736894898c0a637372665f746f6b656e948c2865623230306530323536386130666465353364636638363862633866376665333839653561383132948c066c6f63616c65948c02656e94752e	2026-02-24 11:39:04.881465
10	b52babf3-5c9d-40d4-9355-d534bb1d9d4a	\\x80049513010000000000007d94288c0a5f7065726d616e656e7494888c065f667265736894888c0a637372665f746f6b656e948c2861353865393436386235356230373564383062393935613161633733653465323465646234666334948c066c6f63616c65948c02656e948c085f757365725f6964944b028c035f6964948c803263373034343537343834353235363938313636303038653363653831663161383632666566613930316665363164643432653137353066333130363733383462363362303831383331663239383935373466356331343663616364386237386438656663373635386363336565316437323664633562313337376566316234948c116461675f7374617475735f66696c746572948c03616c6c94752e	2026-02-24 12:17:48.204342
12	5d8c7656-8bb5-4152-92ce-be9d82e6be74	\\x80049513010000000000007d94288c0a5f7065726d616e656e7494888c065f667265736894888c0a637372665f746f6b656e948c2861633136396130336465626231373362333233636163373031313037363161613633383330313963948c066c6f63616c65948c02656e948c085f757365725f6964944b028c035f6964948c803263373034343537343834353235363938313636303038653363653831663161383632666566613930316665363164643432653137353066333130363733383462363362303831383331663239383935373466356331343663616364386237386438656663373635386363336565316437323664633562313337376566316234948c116461675f7374617475735f66696c746572948c03616c6c94752e	2026-02-24 12:18:25.171639
8	7d89a340-62ac-4b48-b466-775f86f3e24e	\\x80049563000000000000007d94288c0a5f7065726d616e656e7494888c065f667265736894898c0a637372665f746f6b656e948c2833366538306265303465646133643261393037326633613433623763653237663765313736323664948c066c6f63616c65948c02656e94752e	2026-02-24 11:40:47.108317
11	d945f83f-8003-47ca-8d7e-4a4c64424677	\\x80049563000000000000007d94288c0a5f7065726d616e656e7494888c065f667265736894898c0a637372665f746f6b656e948c2861633136396130336465626231373362333233636163373031313037363161613633383330313963948c066c6f63616c65948c02656e94752e	2026-02-24 12:18:18.456535
2	c6a29143-f2ec-4304-8741-97d8f50ddb61	\\x8004951d000000000000007d94288c0a5f7065726d616e656e7494888c065f66726573689489752e	2026-02-24 11:13:38.908675
3	1696a0e6-3727-43dc-98e4-87ef58396010	\\x80049563000000000000007d94288c0a5f7065726d616e656e7494888c065f667265736894898c0a637372665f746f6b656e948c2866636538326364663466623330333536623036616130313262613965653765323562383430633830948c066c6f63616c65948c02656e94752e	2026-02-24 11:36:05.966581
9	03d613c4-44a5-4822-a4b7-4df51d59a034	\\x80049563000000000000007d94288c0a5f7065726d616e656e7494888c065f667265736894898c0a637372665f746f6b656e948c2861353865393436386235356230373564383062393935613161633733653465323465646234666334948c066c6f63616c65948c02656e94752e	2026-02-24 12:17:43.175436
13	f452a8de-db34-4293-9ce9-1009f9614fb6	\\x80049563000000000000007d94288c0a5f7065726d616e656e7494888c065f667265736894898c0a637372665f746f6b656e948c2863386631356139303763396137363533653965346235353963653736653065306133353464386238948c066c6f63616c65948c02656e94752e	2026-02-24 12:33:16.207171
\.


--
-- Data for Name: sla_miss; Type: TABLE DATA; Schema: public; Owner: admin
--

COPY public.sla_miss (task_id, dag_id, execution_date, email_sent, "timestamp", description, notification_sent) FROM stdin;
\.


--
-- Data for Name: slot_pool; Type: TABLE DATA; Schema: public; Owner: admin
--

COPY public.slot_pool (id, pool, slots, description, include_deferred) FROM stdin;
1	default_pool	128	Default pool	f
\.


--
-- Data for Name: task_fail; Type: TABLE DATA; Schema: public; Owner: admin
--

COPY public.task_fail (id, task_id, dag_id, run_id, map_index, start_date, end_date, duration) FROM stdin;
\.


--
-- Data for Name: task_instance; Type: TABLE DATA; Schema: public; Owner: admin
--

COPY public.task_instance (task_id, dag_id, run_id, map_index, start_date, end_date, duration, state, try_number, max_tries, hostname, unixname, job_id, pool, pool_slots, queue, priority_weight, operator, custom_operator_name, queued_dttm, queued_by_job_id, pid, executor_config, updated_at, external_executor_id, trigger_id, trigger_timeout, next_method, next_kwargs) FROM stdin;
\.


--
-- Data for Name: task_instance_note; Type: TABLE DATA; Schema: public; Owner: admin
--

COPY public.task_instance_note (user_id, task_id, dag_id, run_id, map_index, content, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: task_map; Type: TABLE DATA; Schema: public; Owner: admin
--

COPY public.task_map (dag_id, task_id, run_id, map_index, length, keys) FROM stdin;
\.


--
-- Data for Name: task_outlet_dataset_reference; Type: TABLE DATA; Schema: public; Owner: admin
--

COPY public.task_outlet_dataset_reference (dataset_id, dag_id, task_id, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: task_reschedule; Type: TABLE DATA; Schema: public; Owner: admin
--

COPY public.task_reschedule (id, task_id, dag_id, run_id, map_index, try_number, start_date, end_date, duration, reschedule_date) FROM stdin;
\.


--
-- Data for Name: tenants; Type: TABLE DATA; Schema: public; Owner: admin
--

COPY public.tenants (tenant_sk, tenant_id, company_name, timezone, currency, is_active, created_at) FROM stdin;
1	b66abf98-6067-4495-b123-4be3af572604	NexStay MVP Hotel	UTC	USD	t	2026-01-18 18:07:55.697096
\.


--
-- Data for Name: trigger; Type: TABLE DATA; Schema: public; Owner: admin
--

COPY public.trigger (id, classpath, kwargs, created_date, triggerer_id) FROM stdin;
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: admin
--

COPY public.users (user_id, tenant_id, username, password_hash, role, created_at, loaded_at) FROM stdin;
1	b66abf98-6067-4495-b123-4be3af572604	ataika	admin123	admin	2026-01-18 18:07:56.067381	2026-01-18 18:07:56.067381
\.


--
-- Data for Name: variable; Type: TABLE DATA; Schema: public; Owner: admin
--

COPY public.variable (id, key, val, description, is_encrypted) FROM stdin;
\.


--
-- Data for Name: xcom; Type: TABLE DATA; Schema: public; Owner: admin
--

COPY public.xcom (dag_run_id, task_id, map_index, key, dag_id, run_id, value, "timestamp") FROM stdin;
\.


--
-- Data for Name: my_first_dbt_model; Type: TABLE DATA; Schema: stg; Owner: admin
--

COPY stg.my_first_dbt_model (id) FROM stdin;
1
\N
\.


--
-- Name: ab_permission_id_seq; Type: SEQUENCE SET; Schema: public; Owner: admin
--

SELECT pg_catalog.setval('public.ab_permission_id_seq', 10, true);


--
-- Name: ab_permission_view_id_seq; Type: SEQUENCE SET; Schema: public; Owner: admin
--

SELECT pg_catalog.setval('public.ab_permission_view_id_seq', 94, true);


--
-- Name: ab_permission_view_role_id_seq; Type: SEQUENCE SET; Schema: public; Owner: admin
--

SELECT pg_catalog.setval('public.ab_permission_view_role_id_seq', 230, true);


--
-- Name: ab_register_user_id_seq; Type: SEQUENCE SET; Schema: public; Owner: admin
--

SELECT pg_catalog.setval('public.ab_register_user_id_seq', 1, false);


--
-- Name: ab_role_id_seq; Type: SEQUENCE SET; Schema: public; Owner: admin
--

SELECT pg_catalog.setval('public.ab_role_id_seq', 5, true);


--
-- Name: ab_user_id_seq; Type: SEQUENCE SET; Schema: public; Owner: admin
--

SELECT pg_catalog.setval('public.ab_user_id_seq', 3, true);


--
-- Name: ab_user_role_id_seq; Type: SEQUENCE SET; Schema: public; Owner: admin
--

SELECT pg_catalog.setval('public.ab_user_role_id_seq', 3, true);


--
-- Name: ab_view_menu_id_seq; Type: SEQUENCE SET; Schema: public; Owner: admin
--

SELECT pg_catalog.setval('public.ab_view_menu_id_seq', 51, true);


--
-- Name: callback_request_id_seq; Type: SEQUENCE SET; Schema: public; Owner: admin
--

SELECT pg_catalog.setval('public.callback_request_id_seq', 1, false);


--
-- Name: connection_id_seq; Type: SEQUENCE SET; Schema: public; Owner: admin
--

SELECT pg_catalog.setval('public.connection_id_seq', 58, true);


--
-- Name: dag_pickle_id_seq; Type: SEQUENCE SET; Schema: public; Owner: admin
--

SELECT pg_catalog.setval('public.dag_pickle_id_seq', 1, false);


--
-- Name: dag_run_id_seq; Type: SEQUENCE SET; Schema: public; Owner: admin
--

SELECT pg_catalog.setval('public.dag_run_id_seq', 1, false);


--
-- Name: dataset_event_id_seq; Type: SEQUENCE SET; Schema: public; Owner: admin
--

SELECT pg_catalog.setval('public.dataset_event_id_seq', 1, false);


--
-- Name: dataset_id_seq; Type: SEQUENCE SET; Schema: public; Owner: admin
--

SELECT pg_catalog.setval('public.dataset_id_seq', 1, false);


--
-- Name: import_error_id_seq; Type: SEQUENCE SET; Schema: public; Owner: admin
--

SELECT pg_catalog.setval('public.import_error_id_seq', 1, false);


--
-- Name: job_id_seq; Type: SEQUENCE SET; Schema: public; Owner: admin
--

SELECT pg_catalog.setval('public.job_id_seq', 6, true);


--
-- Name: log_id_seq; Type: SEQUENCE SET; Schema: public; Owner: admin
--

SELECT pg_catalog.setval('public.log_id_seq', 17, true);


--
-- Name: log_template_id_seq; Type: SEQUENCE SET; Schema: public; Owner: admin
--

SELECT pg_catalog.setval('public.log_template_id_seq', 2, true);


--
-- Name: session_id_seq; Type: SEQUENCE SET; Schema: public; Owner: admin
--

SELECT pg_catalog.setval('public.session_id_seq', 14, true);


--
-- Name: slot_pool_id_seq; Type: SEQUENCE SET; Schema: public; Owner: admin
--

SELECT pg_catalog.setval('public.slot_pool_id_seq', 1, true);


--
-- Name: task_fail_id_seq; Type: SEQUENCE SET; Schema: public; Owner: admin
--

SELECT pg_catalog.setval('public.task_fail_id_seq', 1, false);


--
-- Name: task_reschedule_id_seq; Type: SEQUENCE SET; Schema: public; Owner: admin
--

SELECT pg_catalog.setval('public.task_reschedule_id_seq', 1, false);


--
-- Name: tenants_tenant_sk_seq; Type: SEQUENCE SET; Schema: public; Owner: admin
--

SELECT pg_catalog.setval('public.tenants_tenant_sk_seq', 1, true);


--
-- Name: trigger_id_seq; Type: SEQUENCE SET; Schema: public; Owner: admin
--

SELECT pg_catalog.setval('public.trigger_id_seq', 1, false);


--
-- Name: users_user_id_seq; Type: SEQUENCE SET; Schema: public; Owner: admin
--

SELECT pg_catalog.setval('public.users_user_id_seq', 1, true);


--
-- Name: variable_id_seq; Type: SEQUENCE SET; Schema: public; Owner: admin
--

SELECT pg_catalog.setval('public.variable_id_seq', 1, false);


--
-- Name: ab_permission ab_permission_name_uq; Type: CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.ab_permission
    ADD CONSTRAINT ab_permission_name_uq UNIQUE (name);


--
-- Name: ab_permission ab_permission_pkey; Type: CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.ab_permission
    ADD CONSTRAINT ab_permission_pkey PRIMARY KEY (id);


--
-- Name: ab_permission_view ab_permission_view_permission_id_view_menu_id_uq; Type: CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.ab_permission_view
    ADD CONSTRAINT ab_permission_view_permission_id_view_menu_id_uq UNIQUE (permission_id, view_menu_id);


--
-- Name: ab_permission_view ab_permission_view_pkey; Type: CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.ab_permission_view
    ADD CONSTRAINT ab_permission_view_pkey PRIMARY KEY (id);


--
-- Name: ab_permission_view_role ab_permission_view_role_permission_view_id_role_id_uq; Type: CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.ab_permission_view_role
    ADD CONSTRAINT ab_permission_view_role_permission_view_id_role_id_uq UNIQUE (permission_view_id, role_id);


--
-- Name: ab_permission_view_role ab_permission_view_role_pkey; Type: CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.ab_permission_view_role
    ADD CONSTRAINT ab_permission_view_role_pkey PRIMARY KEY (id);


--
-- Name: ab_register_user ab_register_user_pkey; Type: CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.ab_register_user
    ADD CONSTRAINT ab_register_user_pkey PRIMARY KEY (id);


--
-- Name: ab_register_user ab_register_user_username_uq; Type: CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.ab_register_user
    ADD CONSTRAINT ab_register_user_username_uq UNIQUE (username);


--
-- Name: ab_role ab_role_name_uq; Type: CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.ab_role
    ADD CONSTRAINT ab_role_name_uq UNIQUE (name);


--
-- Name: ab_role ab_role_pkey; Type: CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.ab_role
    ADD CONSTRAINT ab_role_pkey PRIMARY KEY (id);


--
-- Name: ab_user ab_user_email_uq; Type: CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.ab_user
    ADD CONSTRAINT ab_user_email_uq UNIQUE (email);


--
-- Name: ab_user ab_user_pkey; Type: CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.ab_user
    ADD CONSTRAINT ab_user_pkey PRIMARY KEY (id);


--
-- Name: ab_user_role ab_user_role_pkey; Type: CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.ab_user_role
    ADD CONSTRAINT ab_user_role_pkey PRIMARY KEY (id);


--
-- Name: ab_user_role ab_user_role_user_id_role_id_uq; Type: CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.ab_user_role
    ADD CONSTRAINT ab_user_role_user_id_role_id_uq UNIQUE (user_id, role_id);


--
-- Name: ab_user ab_user_username_uq; Type: CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.ab_user
    ADD CONSTRAINT ab_user_username_uq UNIQUE (username);


--
-- Name: ab_view_menu ab_view_menu_name_uq; Type: CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.ab_view_menu
    ADD CONSTRAINT ab_view_menu_name_uq UNIQUE (name);


--
-- Name: ab_view_menu ab_view_menu_pkey; Type: CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.ab_view_menu
    ADD CONSTRAINT ab_view_menu_pkey PRIMARY KEY (id);


--
-- Name: alembic_version alembic_version_pkc; Type: CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.alembic_version
    ADD CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num);


--
-- Name: bookings bookings_pkey; Type: CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_pkey PRIMARY KEY (booking_id);


--
-- Name: callback_request callback_request_pkey; Type: CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.callback_request
    ADD CONSTRAINT callback_request_pkey PRIMARY KEY (id);


--
-- Name: cleaning_tasks cleaning_tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.cleaning_tasks
    ADD CONSTRAINT cleaning_tasks_pkey PRIMARY KEY (task_id);


--
-- Name: clients clients_pkey; Type: CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.clients
    ADD CONSTRAINT clients_pkey PRIMARY KEY (client_id);


--
-- Name: connection connection_conn_id_uq; Type: CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.connection
    ADD CONSTRAINT connection_conn_id_uq UNIQUE (conn_id);


--
-- Name: connection connection_pkey; Type: CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.connection
    ADD CONSTRAINT connection_pkey PRIMARY KEY (id);


--
-- Name: dag_code dag_code_pkey; Type: CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.dag_code
    ADD CONSTRAINT dag_code_pkey PRIMARY KEY (fileloc_hash);


--
-- Name: dag_owner_attributes dag_owner_attributes_pkey; Type: CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.dag_owner_attributes
    ADD CONSTRAINT dag_owner_attributes_pkey PRIMARY KEY (dag_id, owner);


--
-- Name: dag_pickle dag_pickle_pkey; Type: CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.dag_pickle
    ADD CONSTRAINT dag_pickle_pkey PRIMARY KEY (id);


--
-- Name: dag dag_pkey; Type: CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.dag
    ADD CONSTRAINT dag_pkey PRIMARY KEY (dag_id);


--
-- Name: dag_run dag_run_dag_id_execution_date_key; Type: CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.dag_run
    ADD CONSTRAINT dag_run_dag_id_execution_date_key UNIQUE (dag_id, execution_date);


--
-- Name: dag_run dag_run_dag_id_run_id_key; Type: CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.dag_run
    ADD CONSTRAINT dag_run_dag_id_run_id_key UNIQUE (dag_id, run_id);


--
-- Name: dag_run_note dag_run_note_pkey; Type: CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.dag_run_note
    ADD CONSTRAINT dag_run_note_pkey PRIMARY KEY (dag_run_id);


--
-- Name: dag_run dag_run_pkey; Type: CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.dag_run
    ADD CONSTRAINT dag_run_pkey PRIMARY KEY (id);


--
-- Name: dag_tag dag_tag_pkey; Type: CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.dag_tag
    ADD CONSTRAINT dag_tag_pkey PRIMARY KEY (name, dag_id);


--
-- Name: dag_warning dag_warning_pkey; Type: CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.dag_warning
    ADD CONSTRAINT dag_warning_pkey PRIMARY KEY (dag_id, warning_type);


--
-- Name: dagrun_dataset_event dagrun_dataset_event_pkey; Type: CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.dagrun_dataset_event
    ADD CONSTRAINT dagrun_dataset_event_pkey PRIMARY KEY (dag_run_id, event_id);


--
-- Name: dataset_event dataset_event_pkey; Type: CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.dataset_event
    ADD CONSTRAINT dataset_event_pkey PRIMARY KEY (id);


--
-- Name: dataset dataset_pkey; Type: CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.dataset
    ADD CONSTRAINT dataset_pkey PRIMARY KEY (id);


--
-- Name: dataset_dag_run_queue datasetdagrunqueue_pkey; Type: CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.dataset_dag_run_queue
    ADD CONSTRAINT datasetdagrunqueue_pkey PRIMARY KEY (dataset_id, target_dag_id);


--
-- Name: dag_schedule_dataset_reference dsdr_pkey; Type: CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.dag_schedule_dataset_reference
    ADD CONSTRAINT dsdr_pkey PRIMARY KEY (dataset_id, dag_id);


--
-- Name: import_error import_error_pkey; Type: CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.import_error
    ADD CONSTRAINT import_error_pkey PRIMARY KEY (id);


--
-- Name: job job_pkey; Type: CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.job
    ADD CONSTRAINT job_pkey PRIMARY KEY (id);


--
-- Name: log log_pkey; Type: CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.log
    ADD CONSTRAINT log_pkey PRIMARY KEY (id);


--
-- Name: log_template log_template_pkey; Type: CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.log_template
    ADD CONSTRAINT log_template_pkey PRIMARY KEY (id);


--
-- Name: rendered_task_instance_fields rendered_task_instance_fields_pkey; Type: CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.rendered_task_instance_fields
    ADD CONSTRAINT rendered_task_instance_fields_pkey PRIMARY KEY (dag_id, task_id, run_id, map_index);


--
-- Name: rooms rooms_pkey; Type: CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.rooms
    ADD CONSTRAINT rooms_pkey PRIMARY KEY (room_id);


--
-- Name: serialized_dag serialized_dag_pkey; Type: CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.serialized_dag
    ADD CONSTRAINT serialized_dag_pkey PRIMARY KEY (dag_id);


--
-- Name: session session_pkey; Type: CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.session
    ADD CONSTRAINT session_pkey PRIMARY KEY (id);


--
-- Name: session session_session_id_key; Type: CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.session
    ADD CONSTRAINT session_session_id_key UNIQUE (session_id);


--
-- Name: sla_miss sla_miss_pkey; Type: CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.sla_miss
    ADD CONSTRAINT sla_miss_pkey PRIMARY KEY (task_id, dag_id, execution_date);


--
-- Name: slot_pool slot_pool_pkey; Type: CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.slot_pool
    ADD CONSTRAINT slot_pool_pkey PRIMARY KEY (id);


--
-- Name: slot_pool slot_pool_pool_uq; Type: CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.slot_pool
    ADD CONSTRAINT slot_pool_pool_uq UNIQUE (pool);


--
-- Name: task_fail task_fail_pkey; Type: CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.task_fail
    ADD CONSTRAINT task_fail_pkey PRIMARY KEY (id);


--
-- Name: task_instance_note task_instance_note_pkey; Type: CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.task_instance_note
    ADD CONSTRAINT task_instance_note_pkey PRIMARY KEY (task_id, dag_id, run_id, map_index);


--
-- Name: task_instance task_instance_pkey; Type: CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.task_instance
    ADD CONSTRAINT task_instance_pkey PRIMARY KEY (dag_id, task_id, run_id, map_index);


--
-- Name: task_map task_map_pkey; Type: CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.task_map
    ADD CONSTRAINT task_map_pkey PRIMARY KEY (dag_id, task_id, run_id, map_index);


--
-- Name: task_reschedule task_reschedule_pkey; Type: CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.task_reschedule
    ADD CONSTRAINT task_reschedule_pkey PRIMARY KEY (id);


--
-- Name: tenants tenants_pkey; Type: CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.tenants
    ADD CONSTRAINT tenants_pkey PRIMARY KEY (tenant_sk);


--
-- Name: tenants tenants_tenant_id_key; Type: CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.tenants
    ADD CONSTRAINT tenants_tenant_id_key UNIQUE (tenant_id);


--
-- Name: task_outlet_dataset_reference todr_pkey; Type: CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.task_outlet_dataset_reference
    ADD CONSTRAINT todr_pkey PRIMARY KEY (dataset_id, dag_id, task_id);


--
-- Name: trigger trigger_pkey; Type: CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.trigger
    ADD CONSTRAINT trigger_pkey PRIMARY KEY (id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (user_id);


--
-- Name: users users_username_key; Type: CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key UNIQUE (username);


--
-- Name: variable variable_key_uq; Type: CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.variable
    ADD CONSTRAINT variable_key_uq UNIQUE (key);


--
-- Name: variable variable_pkey; Type: CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.variable
    ADD CONSTRAINT variable_pkey PRIMARY KEY (id);


--
-- Name: xcom xcom_pkey; Type: CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.xcom
    ADD CONSTRAINT xcom_pkey PRIMARY KEY (dag_run_id, task_id, map_index, key);


--
-- Name: dag_id_state; Type: INDEX; Schema: public; Owner: admin
--

CREATE INDEX dag_id_state ON public.dag_run USING btree (dag_id, state);


--
-- Name: idx_ab_register_user_username; Type: INDEX; Schema: public; Owner: admin
--

CREATE UNIQUE INDEX idx_ab_register_user_username ON public.ab_register_user USING btree (lower((username)::text));


--
-- Name: idx_ab_user_username; Type: INDEX; Schema: public; Owner: admin
--

CREATE UNIQUE INDEX idx_ab_user_username ON public.ab_user USING btree (lower((username)::text));


--
-- Name: idx_dag_run_dag_id; Type: INDEX; Schema: public; Owner: admin
--

CREATE INDEX idx_dag_run_dag_id ON public.dag_run USING btree (dag_id);


--
-- Name: idx_dag_run_queued_dags; Type: INDEX; Schema: public; Owner: admin
--

CREATE INDEX idx_dag_run_queued_dags ON public.dag_run USING btree (state, dag_id) WHERE ((state)::text = 'queued'::text);


--
-- Name: idx_dag_run_running_dags; Type: INDEX; Schema: public; Owner: admin
--

CREATE INDEX idx_dag_run_running_dags ON public.dag_run USING btree (state, dag_id) WHERE ((state)::text = 'running'::text);


--
-- Name: idx_dagrun_dataset_events_dag_run_id; Type: INDEX; Schema: public; Owner: admin
--

CREATE INDEX idx_dagrun_dataset_events_dag_run_id ON public.dagrun_dataset_event USING btree (dag_run_id);


--
-- Name: idx_dagrun_dataset_events_event_id; Type: INDEX; Schema: public; Owner: admin
--

CREATE INDEX idx_dagrun_dataset_events_event_id ON public.dagrun_dataset_event USING btree (event_id);


--
-- Name: idx_dataset_id_timestamp; Type: INDEX; Schema: public; Owner: admin
--

CREATE INDEX idx_dataset_id_timestamp ON public.dataset_event USING btree (dataset_id, "timestamp");


--
-- Name: idx_fileloc_hash; Type: INDEX; Schema: public; Owner: admin
--

CREATE INDEX idx_fileloc_hash ON public.serialized_dag USING btree (fileloc_hash);


--
-- Name: idx_job_dag_id; Type: INDEX; Schema: public; Owner: admin
--

CREATE INDEX idx_job_dag_id ON public.job USING btree (dag_id);


--
-- Name: idx_job_state_heartbeat; Type: INDEX; Schema: public; Owner: admin
--

CREATE INDEX idx_job_state_heartbeat ON public.job USING btree (state, latest_heartbeat);


--
-- Name: idx_last_scheduling_decision; Type: INDEX; Schema: public; Owner: admin
--

CREATE INDEX idx_last_scheduling_decision ON public.dag_run USING btree (last_scheduling_decision);


--
-- Name: idx_log_dag; Type: INDEX; Schema: public; Owner: admin
--

CREATE INDEX idx_log_dag ON public.log USING btree (dag_id);


--
-- Name: idx_log_dttm; Type: INDEX; Schema: public; Owner: admin
--

CREATE INDEX idx_log_dttm ON public.log USING btree (dttm);


--
-- Name: idx_log_event; Type: INDEX; Schema: public; Owner: admin
--

CREATE INDEX idx_log_event ON public.log USING btree (event);


--
-- Name: idx_next_dagrun_create_after; Type: INDEX; Schema: public; Owner: admin
--

CREATE INDEX idx_next_dagrun_create_after ON public.dag USING btree (next_dagrun_create_after);


--
-- Name: idx_root_dag_id; Type: INDEX; Schema: public; Owner: admin
--

CREATE INDEX idx_root_dag_id ON public.dag USING btree (root_dag_id);


--
-- Name: idx_task_fail_task_instance; Type: INDEX; Schema: public; Owner: admin
--

CREATE INDEX idx_task_fail_task_instance ON public.task_fail USING btree (dag_id, task_id, run_id, map_index);


--
-- Name: idx_task_reschedule_dag_run; Type: INDEX; Schema: public; Owner: admin
--

CREATE INDEX idx_task_reschedule_dag_run ON public.task_reschedule USING btree (dag_id, run_id);


--
-- Name: idx_task_reschedule_dag_task_run; Type: INDEX; Schema: public; Owner: admin
--

CREATE INDEX idx_task_reschedule_dag_task_run ON public.task_reschedule USING btree (dag_id, task_id, run_id, map_index);


--
-- Name: idx_uri_unique; Type: INDEX; Schema: public; Owner: admin
--

CREATE UNIQUE INDEX idx_uri_unique ON public.dataset USING btree (uri);


--
-- Name: idx_xcom_key; Type: INDEX; Schema: public; Owner: admin
--

CREATE INDEX idx_xcom_key ON public.xcom USING btree (key);


--
-- Name: idx_xcom_task_instance; Type: INDEX; Schema: public; Owner: admin
--

CREATE INDEX idx_xcom_task_instance ON public.xcom USING btree (dag_id, task_id, run_id, map_index);


--
-- Name: job_type_heart; Type: INDEX; Schema: public; Owner: admin
--

CREATE INDEX job_type_heart ON public.job USING btree (job_type, latest_heartbeat);


--
-- Name: sm_dag; Type: INDEX; Schema: public; Owner: admin
--

CREATE INDEX sm_dag ON public.sla_miss USING btree (dag_id);


--
-- Name: ti_dag_run; Type: INDEX; Schema: public; Owner: admin
--

CREATE INDEX ti_dag_run ON public.task_instance USING btree (dag_id, run_id);


--
-- Name: ti_dag_state; Type: INDEX; Schema: public; Owner: admin
--

CREATE INDEX ti_dag_state ON public.task_instance USING btree (dag_id, state);


--
-- Name: ti_job_id; Type: INDEX; Schema: public; Owner: admin
--

CREATE INDEX ti_job_id ON public.task_instance USING btree (job_id);


--
-- Name: ti_pool; Type: INDEX; Schema: public; Owner: admin
--

CREATE INDEX ti_pool ON public.task_instance USING btree (pool, state, priority_weight);


--
-- Name: ti_state; Type: INDEX; Schema: public; Owner: admin
--

CREATE INDEX ti_state ON public.task_instance USING btree (state);


--
-- Name: ti_state_incl_start_date; Type: INDEX; Schema: public; Owner: admin
--

CREATE INDEX ti_state_incl_start_date ON public.task_instance USING btree (dag_id, task_id, state) INCLUDE (start_date);


--
-- Name: ti_state_lkp; Type: INDEX; Schema: public; Owner: admin
--

CREATE INDEX ti_state_lkp ON public.task_instance USING btree (dag_id, task_id, run_id, state);


--
-- Name: ti_trigger_id; Type: INDEX; Schema: public; Owner: admin
--

CREATE INDEX ti_trigger_id ON public.task_instance USING btree (trigger_id);


--
-- Name: ab_permission_view ab_permission_view_permission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.ab_permission_view
    ADD CONSTRAINT ab_permission_view_permission_id_fkey FOREIGN KEY (permission_id) REFERENCES public.ab_permission(id);


--
-- Name: ab_permission_view_role ab_permission_view_role_permission_view_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.ab_permission_view_role
    ADD CONSTRAINT ab_permission_view_role_permission_view_id_fkey FOREIGN KEY (permission_view_id) REFERENCES public.ab_permission_view(id);


--
-- Name: ab_permission_view_role ab_permission_view_role_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.ab_permission_view_role
    ADD CONSTRAINT ab_permission_view_role_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.ab_role(id);


--
-- Name: ab_permission_view ab_permission_view_view_menu_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.ab_permission_view
    ADD CONSTRAINT ab_permission_view_view_menu_id_fkey FOREIGN KEY (view_menu_id) REFERENCES public.ab_view_menu(id);


--
-- Name: ab_user ab_user_changed_by_fk_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.ab_user
    ADD CONSTRAINT ab_user_changed_by_fk_fkey FOREIGN KEY (changed_by_fk) REFERENCES public.ab_user(id);


--
-- Name: ab_user ab_user_created_by_fk_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.ab_user
    ADD CONSTRAINT ab_user_created_by_fk_fkey FOREIGN KEY (created_by_fk) REFERENCES public.ab_user(id);


--
-- Name: ab_user_role ab_user_role_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.ab_user_role
    ADD CONSTRAINT ab_user_role_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.ab_role(id);


--
-- Name: ab_user_role ab_user_role_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.ab_user_role
    ADD CONSTRAINT ab_user_role_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.ab_user(id);


--
-- Name: bookings bookings_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(client_id);


--
-- Name: bookings bookings_room_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_room_id_fkey FOREIGN KEY (room_id) REFERENCES public.rooms(room_id);


--
-- Name: bookings bookings_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(tenant_id);


--
-- Name: cleaning_tasks cleaning_tasks_assigned_to_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.cleaning_tasks
    ADD CONSTRAINT cleaning_tasks_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.users(user_id);


--
-- Name: cleaning_tasks cleaning_tasks_room_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.cleaning_tasks
    ADD CONSTRAINT cleaning_tasks_room_id_fkey FOREIGN KEY (room_id) REFERENCES public.rooms(room_id);


--
-- Name: cleaning_tasks cleaning_tasks_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.cleaning_tasks
    ADD CONSTRAINT cleaning_tasks_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(tenant_id);


--
-- Name: clients clients_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.clients
    ADD CONSTRAINT clients_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(tenant_id);


--
-- Name: dag_owner_attributes dag.dag_id; Type: FK CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.dag_owner_attributes
    ADD CONSTRAINT "dag.dag_id" FOREIGN KEY (dag_id) REFERENCES public.dag(dag_id) ON DELETE CASCADE;


--
-- Name: dag_run_note dag_run_note_dr_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.dag_run_note
    ADD CONSTRAINT dag_run_note_dr_fkey FOREIGN KEY (dag_run_id) REFERENCES public.dag_run(id) ON DELETE CASCADE;


--
-- Name: dag_run_note dag_run_note_user_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.dag_run_note
    ADD CONSTRAINT dag_run_note_user_fkey FOREIGN KEY (user_id) REFERENCES public.ab_user(id);


--
-- Name: dag_tag dag_tag_dag_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.dag_tag
    ADD CONSTRAINT dag_tag_dag_id_fkey FOREIGN KEY (dag_id) REFERENCES public.dag(dag_id) ON DELETE CASCADE;


--
-- Name: dagrun_dataset_event dagrun_dataset_event_dag_run_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.dagrun_dataset_event
    ADD CONSTRAINT dagrun_dataset_event_dag_run_id_fkey FOREIGN KEY (dag_run_id) REFERENCES public.dag_run(id) ON DELETE CASCADE;


--
-- Name: dagrun_dataset_event dagrun_dataset_event_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.dagrun_dataset_event
    ADD CONSTRAINT dagrun_dataset_event_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.dataset_event(id) ON DELETE CASCADE;


--
-- Name: dag_warning dcw_dag_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.dag_warning
    ADD CONSTRAINT dcw_dag_id_fkey FOREIGN KEY (dag_id) REFERENCES public.dag(dag_id) ON DELETE CASCADE;


--
-- Name: dataset_dag_run_queue ddrq_dag_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.dataset_dag_run_queue
    ADD CONSTRAINT ddrq_dag_fkey FOREIGN KEY (target_dag_id) REFERENCES public.dag(dag_id) ON DELETE CASCADE;


--
-- Name: dataset_dag_run_queue ddrq_dataset_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.dataset_dag_run_queue
    ADD CONSTRAINT ddrq_dataset_fkey FOREIGN KEY (dataset_id) REFERENCES public.dataset(id) ON DELETE CASCADE;


--
-- Name: dag_schedule_dataset_reference dsdr_dag_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.dag_schedule_dataset_reference
    ADD CONSTRAINT dsdr_dag_id_fkey FOREIGN KEY (dag_id) REFERENCES public.dag(dag_id) ON DELETE CASCADE;


--
-- Name: dag_schedule_dataset_reference dsdr_dataset_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.dag_schedule_dataset_reference
    ADD CONSTRAINT dsdr_dataset_fkey FOREIGN KEY (dataset_id) REFERENCES public.dataset(id) ON DELETE CASCADE;


--
-- Name: rooms rooms_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.rooms
    ADD CONSTRAINT rooms_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(tenant_id);


--
-- Name: rendered_task_instance_fields rtif_ti_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.rendered_task_instance_fields
    ADD CONSTRAINT rtif_ti_fkey FOREIGN KEY (dag_id, task_id, run_id, map_index) REFERENCES public.task_instance(dag_id, task_id, run_id, map_index) ON DELETE CASCADE;


--
-- Name: task_fail task_fail_ti_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.task_fail
    ADD CONSTRAINT task_fail_ti_fkey FOREIGN KEY (dag_id, task_id, run_id, map_index) REFERENCES public.task_instance(dag_id, task_id, run_id, map_index) ON DELETE CASCADE;


--
-- Name: task_instance task_instance_dag_run_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.task_instance
    ADD CONSTRAINT task_instance_dag_run_fkey FOREIGN KEY (dag_id, run_id) REFERENCES public.dag_run(dag_id, run_id) ON DELETE CASCADE;


--
-- Name: dag_run task_instance_log_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.dag_run
    ADD CONSTRAINT task_instance_log_template_id_fkey FOREIGN KEY (log_template_id) REFERENCES public.log_template(id);


--
-- Name: task_instance_note task_instance_note_ti_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.task_instance_note
    ADD CONSTRAINT task_instance_note_ti_fkey FOREIGN KEY (dag_id, task_id, run_id, map_index) REFERENCES public.task_instance(dag_id, task_id, run_id, map_index) ON DELETE CASCADE;


--
-- Name: task_instance_note task_instance_note_user_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.task_instance_note
    ADD CONSTRAINT task_instance_note_user_fkey FOREIGN KEY (user_id) REFERENCES public.ab_user(id);


--
-- Name: task_instance task_instance_trigger_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.task_instance
    ADD CONSTRAINT task_instance_trigger_id_fkey FOREIGN KEY (trigger_id) REFERENCES public.trigger(id) ON DELETE CASCADE;


--
-- Name: task_map task_map_task_instance_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.task_map
    ADD CONSTRAINT task_map_task_instance_fkey FOREIGN KEY (dag_id, task_id, run_id, map_index) REFERENCES public.task_instance(dag_id, task_id, run_id, map_index) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: task_reschedule task_reschedule_dr_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.task_reschedule
    ADD CONSTRAINT task_reschedule_dr_fkey FOREIGN KEY (dag_id, run_id) REFERENCES public.dag_run(dag_id, run_id) ON DELETE CASCADE;


--
-- Name: task_reschedule task_reschedule_ti_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.task_reschedule
    ADD CONSTRAINT task_reschedule_ti_fkey FOREIGN KEY (dag_id, task_id, run_id, map_index) REFERENCES public.task_instance(dag_id, task_id, run_id, map_index) ON DELETE CASCADE;


--
-- Name: task_outlet_dataset_reference todr_dag_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.task_outlet_dataset_reference
    ADD CONSTRAINT todr_dag_id_fkey FOREIGN KEY (dag_id) REFERENCES public.dag(dag_id) ON DELETE CASCADE;


--
-- Name: task_outlet_dataset_reference todr_dataset_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.task_outlet_dataset_reference
    ADD CONSTRAINT todr_dataset_fkey FOREIGN KEY (dataset_id) REFERENCES public.dataset(id) ON DELETE CASCADE;


--
-- Name: users users_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(tenant_id);


--
-- Name: xcom xcom_task_instance_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.xcom
    ADD CONSTRAINT xcom_task_instance_fkey FOREIGN KEY (dag_id, task_id, run_id, map_index) REFERENCES public.task_instance(dag_id, task_id, run_id, map_index) ON DELETE CASCADE;


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: pg_database_owner
--

GRANT USAGE ON SCHEMA public TO superset_ro;


--
-- Name: TABLE ab_permission; Type: ACL; Schema: public; Owner: admin
--

GRANT SELECT ON TABLE public.ab_permission TO superset_ro;


--
-- Name: TABLE ab_permission_view; Type: ACL; Schema: public; Owner: admin
--

GRANT SELECT ON TABLE public.ab_permission_view TO superset_ro;


--
-- Name: TABLE ab_permission_view_role; Type: ACL; Schema: public; Owner: admin
--

GRANT SELECT ON TABLE public.ab_permission_view_role TO superset_ro;


--
-- Name: TABLE ab_register_user; Type: ACL; Schema: public; Owner: admin
--

GRANT SELECT ON TABLE public.ab_register_user TO superset_ro;


--
-- Name: TABLE ab_role; Type: ACL; Schema: public; Owner: admin
--

GRANT SELECT ON TABLE public.ab_role TO superset_ro;


--
-- Name: TABLE ab_user; Type: ACL; Schema: public; Owner: admin
--

GRANT SELECT ON TABLE public.ab_user TO superset_ro;


--
-- Name: TABLE ab_user_role; Type: ACL; Schema: public; Owner: admin
--

GRANT SELECT ON TABLE public.ab_user_role TO superset_ro;


--
-- Name: TABLE ab_view_menu; Type: ACL; Schema: public; Owner: admin
--

GRANT SELECT ON TABLE public.ab_view_menu TO superset_ro;


--
-- Name: TABLE alembic_version; Type: ACL; Schema: public; Owner: admin
--

GRANT SELECT ON TABLE public.alembic_version TO superset_ro;


--
-- Name: TABLE bookings; Type: ACL; Schema: public; Owner: admin
--

GRANT SELECT ON TABLE public.bookings TO superset_ro;


--
-- Name: TABLE callback_request; Type: ACL; Schema: public; Owner: admin
--

GRANT SELECT ON TABLE public.callback_request TO superset_ro;


--
-- Name: TABLE cleaning_tasks; Type: ACL; Schema: public; Owner: admin
--

GRANT SELECT ON TABLE public.cleaning_tasks TO superset_ro;


--
-- Name: TABLE clients; Type: ACL; Schema: public; Owner: admin
--

GRANT SELECT ON TABLE public.clients TO superset_ro;


--
-- Name: TABLE connection; Type: ACL; Schema: public; Owner: admin
--

GRANT SELECT ON TABLE public.connection TO superset_ro;


--
-- Name: TABLE dag; Type: ACL; Schema: public; Owner: admin
--

GRANT SELECT ON TABLE public.dag TO superset_ro;


--
-- Name: TABLE dag_code; Type: ACL; Schema: public; Owner: admin
--

GRANT SELECT ON TABLE public.dag_code TO superset_ro;


--
-- Name: TABLE dag_owner_attributes; Type: ACL; Schema: public; Owner: admin
--

GRANT SELECT ON TABLE public.dag_owner_attributes TO superset_ro;


--
-- Name: TABLE dag_pickle; Type: ACL; Schema: public; Owner: admin
--

GRANT SELECT ON TABLE public.dag_pickle TO superset_ro;


--
-- Name: TABLE dag_run; Type: ACL; Schema: public; Owner: admin
--

GRANT SELECT ON TABLE public.dag_run TO superset_ro;


--
-- Name: TABLE dag_run_note; Type: ACL; Schema: public; Owner: admin
--

GRANT SELECT ON TABLE public.dag_run_note TO superset_ro;


--
-- Name: TABLE dag_schedule_dataset_reference; Type: ACL; Schema: public; Owner: admin
--

GRANT SELECT ON TABLE public.dag_schedule_dataset_reference TO superset_ro;


--
-- Name: TABLE dag_tag; Type: ACL; Schema: public; Owner: admin
--

GRANT SELECT ON TABLE public.dag_tag TO superset_ro;


--
-- Name: TABLE dag_warning; Type: ACL; Schema: public; Owner: admin
--

GRANT SELECT ON TABLE public.dag_warning TO superset_ro;


--
-- Name: TABLE dagrun_dataset_event; Type: ACL; Schema: public; Owner: admin
--

GRANT SELECT ON TABLE public.dagrun_dataset_event TO superset_ro;


--
-- Name: TABLE dataset; Type: ACL; Schema: public; Owner: admin
--

GRANT SELECT ON TABLE public.dataset TO superset_ro;


--
-- Name: TABLE dataset_dag_run_queue; Type: ACL; Schema: public; Owner: admin
--

GRANT SELECT ON TABLE public.dataset_dag_run_queue TO superset_ro;


--
-- Name: TABLE dataset_event; Type: ACL; Schema: public; Owner: admin
--

GRANT SELECT ON TABLE public.dataset_event TO superset_ro;


--
-- Name: TABLE import_error; Type: ACL; Schema: public; Owner: admin
--

GRANT SELECT ON TABLE public.import_error TO superset_ro;


--
-- Name: TABLE job; Type: ACL; Schema: public; Owner: admin
--

GRANT SELECT ON TABLE public.job TO superset_ro;


--
-- Name: TABLE log; Type: ACL; Schema: public; Owner: admin
--

GRANT SELECT ON TABLE public.log TO superset_ro;


--
-- Name: TABLE log_template; Type: ACL; Schema: public; Owner: admin
--

GRANT SELECT ON TABLE public.log_template TO superset_ro;


--
-- Name: TABLE rendered_task_instance_fields; Type: ACL; Schema: public; Owner: admin
--

GRANT SELECT ON TABLE public.rendered_task_instance_fields TO superset_ro;


--
-- Name: TABLE rooms; Type: ACL; Schema: public; Owner: admin
--

GRANT SELECT ON TABLE public.rooms TO superset_ro;


--
-- Name: TABLE serialized_dag; Type: ACL; Schema: public; Owner: admin
--

GRANT SELECT ON TABLE public.serialized_dag TO superset_ro;


--
-- Name: TABLE session; Type: ACL; Schema: public; Owner: admin
--

GRANT SELECT ON TABLE public.session TO superset_ro;


--
-- Name: TABLE sla_miss; Type: ACL; Schema: public; Owner: admin
--

GRANT SELECT ON TABLE public.sla_miss TO superset_ro;


--
-- Name: TABLE slot_pool; Type: ACL; Schema: public; Owner: admin
--

GRANT SELECT ON TABLE public.slot_pool TO superset_ro;


--
-- Name: TABLE task_fail; Type: ACL; Schema: public; Owner: admin
--

GRANT SELECT ON TABLE public.task_fail TO superset_ro;


--
-- Name: TABLE task_instance; Type: ACL; Schema: public; Owner: admin
--

GRANT SELECT ON TABLE public.task_instance TO superset_ro;


--
-- Name: TABLE task_instance_note; Type: ACL; Schema: public; Owner: admin
--

GRANT SELECT ON TABLE public.task_instance_note TO superset_ro;


--
-- Name: TABLE task_map; Type: ACL; Schema: public; Owner: admin
--

GRANT SELECT ON TABLE public.task_map TO superset_ro;


--
-- Name: TABLE task_outlet_dataset_reference; Type: ACL; Schema: public; Owner: admin
--

GRANT SELECT ON TABLE public.task_outlet_dataset_reference TO superset_ro;


--
-- Name: TABLE task_reschedule; Type: ACL; Schema: public; Owner: admin
--

GRANT SELECT ON TABLE public.task_reschedule TO superset_ro;


--
-- Name: TABLE tenants; Type: ACL; Schema: public; Owner: admin
--

GRANT SELECT ON TABLE public.tenants TO superset_ro;


--
-- Name: TABLE trigger; Type: ACL; Schema: public; Owner: admin
--

GRANT SELECT ON TABLE public.trigger TO superset_ro;


--
-- Name: TABLE users; Type: ACL; Schema: public; Owner: admin
--

GRANT SELECT ON TABLE public.users TO superset_ro;


--
-- Name: TABLE variable; Type: ACL; Schema: public; Owner: admin
--

GRANT SELECT ON TABLE public.variable TO superset_ro;


--
-- Name: TABLE xcom; Type: ACL; Schema: public; Owner: admin
--

GRANT SELECT ON TABLE public.xcom TO superset_ro;


--
-- PostgreSQL database dump complete
--

\unrestrict CbYUjS9NOp3NI6ZefiZj8OtdxLd7UOqYHBE9Mto7G50jWep0cwe4URVxg63o6vz

